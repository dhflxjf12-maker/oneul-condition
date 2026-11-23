import { and, lt, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { aiCalls } from "../../db/schema";
import { MAX_AI_CALLS_PER_DAY } from "../domain/constants";
import { kstDateKey } from "./rate-limit";

// Design Ref: §3.1 ai_calls — 하루 호출 횟수를 데이터베이스에 센다. 체크인 값은 저장하지 않는다.
// "한도 안이면 +1, 넘었으면 올리지 않음"을 SQL 한 문장(원자적)으로 처리해서, 동시에 여러 요청이 와도 한도가 샐 수 없다.

/** ai_calls 기록 보관 일수 (Design §3.1: 7일이 지나면 지운다) */
const RETENTION_DAYS = 7;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

/** 날짜 문자열 "YYYY-MM-DD"에서 일수를 뺀다. */
function minusDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** 한도 안이면 횟수를 1 올리고 true, 넘었으면 올리지 않고 false. */
export async function tryConsumeInDb(
  db: AnyPgDb,
  subjectKey: string,
  limit: number = MAX_AI_CALLS_PER_DAY,
  now: Date = new Date(),
): Promise<boolean> {
  const today = kstDateKey(now);
  const rows = await db
    .insert(aiCalls)
    .values({ subjectKey, callDate: today, count: 1 })
    .onConflictDoUpdate({
      target: [aiCalls.subjectKey, aiCalls.callDate],
      set: { count: sql`${aiCalls.count} + 1` },
      // 이미 한도에 닿았으면 갱신하지 않으므로 아무 행도 돌아오지 않는다.
      setWhere: lt(aiCalls.count, limit),
    })
    .returning({ count: aiCalls.count });

  if (rows.length === 0) return false;

  // 그날의 첫 호출일 때만 오래된 기록을 함께 지운다. (별도 예약 작업 없이 정리)
  if (rows[0].count === 1) {
    await db.delete(aiCalls).where(and(lt(aiCalls.callDate, minusDays(today, RETENTION_DAYS))));
  }
  return true;
}
