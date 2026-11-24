import type { PgDatabase } from "drizzle-orm/pg-core";
import { users } from "../../db/schema";
import { hashPassword } from "./password";
import type { SignupInput } from "./validation";

// Design Ref: §4.1 signup — 검사 → 해시 → 저장. 세션 발급은 서버 액션(app/actions/auth.ts)이 한다.
// 이미 가입한 이메일이면 새로 만들지 않고 duplicate를 돌려준다. (화면은 가입 여부가 드러나지 않는 중립 문구를 보여 준다.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

export type SignupResult = { status: "created"; userId: string; sessionVersion: number } | { status: "duplicate" };

/** 계정을 만든다. 비밀번호는 해시로만 저장한다. */
export async function createUser(db: AnyPgDb, input: SignupInput, now: Date = new Date()): Promise<SignupResult> {
  // 이메일이 이미 있든 없든 해시 시간이 같도록 항상 먼저 해시한다. (응답 시간으로 가입 여부를 추측하기 어렵게)
  const passwordHash = await hashPassword(input.password);

  const rows = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash,
      healthConsentAt: now,
      ageConfirmed: input.ageConfirmed,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id, sessionVersion: users.sessionVersion });

  return rows.length === 0 ? { status: "duplicate" } : { status: "created", userId: rows[0].id, sessionVersion: rows[0].sessionVersion };
}
