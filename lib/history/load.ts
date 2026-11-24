import { and, between, desc, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { checkins } from "../../db/schema";
import { TREND_WINDOW_DAYS } from "../domain/constants";
import { addDaysToDateKey } from "../domain/trend";
import type { Intensity } from "../domain/types";
import { kstDateKey } from "../suggestion/rate-limit";

// Design Ref: §5.2 기록·추이 화면 — 최근 점수를 읽어 7일 추이와 기복 예상에 쓴다.
// 반드시 세션의 계정 번호(userId)로만 읽는다. 다른 사람의 번호를 받아 조회하는 코드는 만들지 않는다. (PRD: 본인 기록만 조회)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

export type HistoryRow = { date: string; score: number; intensity: Intensity };

/** 오늘(한국 시간)을 포함한 최근 14일의 내 기록을 최신순으로 읽는다. */
export async function loadRecentHistory(db: AnyPgDb, userId: string, now: Date = new Date()): Promise<{ today: string; rows: HistoryRow[] }> {
  const today = kstDateKey(now);
  const oldest = addDaysToDateKey(today, -(TREND_WINDOW_DAYS - 1));
  const rows = await db
    .select({ date: checkins.checkinDate, score: checkins.score, intensity: checkins.intensity })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), between(checkins.checkinDate, oldest, today)))
    .orderBy(desc(checkins.checkinDate));
  return { today, rows };
}
