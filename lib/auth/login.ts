import { eq, lt, or, and, isNull, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { loginAttempts, users } from "../../db/schema";
import {
  LOGIN_ATTEMPT_RETENTION_DAYS,
  LOGIN_FAILURE_RESET_HOURS,
  LOGIN_LOCK_MINUTES,
  MAX_LOGIN_FAILURES,
} from "../domain/constants";
import { hashPassword, verifyPassword } from "./password";

// Design Ref: §4.3 — 로그인 실패 횟수와 잠금은 이메일 해시 기준(login_attempts)으로 센다. 가입하지 않은 이메일도 똑같이 센다.
// PRD: 5회 연속 실패 시 10분 잠금, 잠금이 풀리면(또는 마지막 실패로부터 24시간이 지나면) 실패 횟수를 0으로 되돌린다.
// 실패 문구는 항상 같아서, 문구·잠금으로 가입 여부를 알 수 없다.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

export type LoginResult =
  | { status: "success"; userId: string; sessionVersion: number }
  | { status: "invalid" }
  | { status: "locked"; remainingSeconds: number };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// 가입하지 않은 이메일에도 같은 시간이 걸리도록, 존재하지 않는 계정에는 이 가짜 해시와 비교한다.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("가짜-비밀번호-시간-맞추기용");
  return dummyHash;
}

function remainingSeconds(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
}

/**
 * 로그인을 시도한다.
 * @param emailHash 이메일을 HMAC 해시한 값 (잠금 기록용)
 * @param email 소문자·공백 제거된 이메일
 */
export async function attemptLogin(
  db: AnyPgDb,
  args: { email: string; emailHash: string; password: string },
  now: Date = new Date(),
): Promise<LoginResult> {
  const { email, emailHash, password } = args;

  // 1) 잠금 중이면 비밀번호가 맞든 틀리든 잠금 안내만 한다. (가입 여부와 상관없이 똑같이)
  const [attempt] = await db.select().from(loginAttempts).where(eq(loginAttempts.emailHash, emailHash));
  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    return { status: "locked", remainingSeconds: remainingSeconds(attempt.lockedUntil, now) };
  }

  // 2) 비밀번호 확인 (가입하지 않은 이메일도 같은 만큼 시간을 쓴다)
  const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash, sessionVersion: users.sessionVersion }).from(users).where(eq(users.email, email));
  const matched = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (user && matched) {
    // 성공: 실패 기록을 지운다.
    await db.delete(loginAttempts).where(eq(loginAttempts.emailHash, emailHash));
    return { status: "success", userId: user.id, sessionVersion: user.sessionVersion };
  }

  // 3) 실패: 횟수를 올린다. 잠금이 풀린 뒤이거나 마지막 실패로부터 24시간이 지났으면 1부터 다시 센다.
  const iso = (date: Date) => sql`${date.toISOString()}::timestamptz`;
  const resetBefore = new Date(now.getTime() - LOGIN_FAILURE_RESET_HOURS * HOUR_MS);
  const lockUntil = new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000);
  const shouldReset = sql`((${loginAttempts.lockedUntil} is not null and ${loginAttempts.lockedUntil} <= ${iso(now)}) or ${loginAttempts.lastFailedAt} < ${iso(resetBefore)})`;
  const nextCount = sql`(case when ${shouldReset} then 1 else ${loginAttempts.failedCount} + 1 end)`;

  // 한 문장으로 처리해서, 동시에 여러 번 시도해도 횟수가 정확히 올라간다.
  const [updated] = await db
    .insert(loginAttempts)
    .values({ emailHash, failedCount: 1, lockedUntil: null, lastFailedAt: now })
    .onConflictDoUpdate({
      target: loginAttempts.emailHash,
      set: {
        failedCount: nextCount,
        lastFailedAt: now,
        lockedUntil: sql`(case when ${nextCount} >= ${MAX_LOGIN_FAILURES} then ${iso(lockUntil)} else null end)`,
      },
    })
    .returning({ lockedUntil: loginAttempts.lockedUntil });

  // 잠금이 풀린 지 하루가 지난 기록과 하루 넘게 실패가 없던 기록은 이때 함께 지운다. (별도 예약 작업 없이 정리)
  const stale = new Date(now.getTime() - LOGIN_ATTEMPT_RETENTION_DAYS * DAY_MS);
  await db
    .delete(loginAttempts)
    .where(or(lt(loginAttempts.lockedUntil, stale), and(isNull(loginAttempts.lockedUntil), lt(loginAttempts.lastFailedAt, stale))));

  if (updated?.lockedUntil && updated.lockedUntil > now) {
    return { status: "locked", remainingSeconds: remainingSeconds(updated.lockedUntil, now) };
  }
  return { status: "invalid" };
}
