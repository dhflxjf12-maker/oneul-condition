import { and, between, eq, isNull } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { z } from "zod";
import { checkins, surveyResponses } from "../../db/schema";
import { kstDateKey } from "../suggestion/rate-limit";

// Design Ref: §3.1 survey_responses·§4.4 — 주 1회 체감 질문. 월요일에 시작하는 한국 시간 기준 주.
// PRD: 매주 첫 체크인을 마친 뒤, 지난주에 기록이 있었던 경우에만 "지난주 점수가 체감과 맞았나요?"를 한 번 묻는다.
// 물어본 사실도 기록(asked_at)해서 응답하지 않아도 그 주에는 다시 묻지 않는다. (지표: "맞았다" 응답 ÷ 전체 응답)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

/** 날짜 문자열 "YYYY-MM-DD"에 일수를 더한다. (달력 계산이라 시간대와 무관) */
export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 그 날짜가 속한 주의 월요일 "YYYY-MM-DD" (월요일 시작) */
export function mondayOf(dateKey: string): string {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0=일 ... 6=토
  return addDays(dateKey, -((day + 6) % 7));
}

/** 질문 대상 주(지난주)의 월요일 */
export function lastWeekStart(today: string): string {
  return addDays(mondayOf(today), -7);
}

export const saveSurveySchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  matched: z.boolean(),
});

export type DueSurvey = { weekStart: string } | null;

/**
 * 지금 체감 질문을 보여 줘야 하면 그 주(지난주 월요일)를 돌려주고, 물어본 사실을 기록한다. 아니면 null.
 * 조건: 오늘 체크인이 저장되어 있고, 지난주에 기록이 있었고, 그 주에 대해 아직 물은 적이 없다.
 */
export async function getDueSurvey(db: AnyPgDb, userId: string, now: Date = new Date()): Promise<DueSurvey> {
  const today = kstDateKey(now);
  const weekStart = lastWeekStart(today);
  const weekEnd = addDays(weekStart, 6);

  // 오늘 체크인을 마친 뒤에만 묻는다.
  const [todays] = await db
    .select({ id: checkins.id })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.checkinDate, today)));
  if (!todays) return null;

  // 지난주에 기록이 하나도 없으면 묻지 않는다.
  const [lastWeek] = await db
    .select({ id: checkins.id })
    .from(checkins)
    .where(and(eq(checkins.userId, userId), between(checkins.checkinDate, weekStart, weekEnd)))
    .limit(1);
  if (!lastWeek) return null;

  // 물어본 사실을 먼저 기록한다. 이미 있으면(이번 주에 이미 물었으면) 다시 묻지 않는다. (동시에 여러 번 와도 한 번만)
  const inserted = await db
    .insert(surveyResponses)
    .values({ userId, weekStart, askedAt: now })
    .onConflictDoNothing({ target: [surveyResponses.userId, surveyResponses.weekStart] })
    .returning({ id: surveyResponses.id });
  return inserted.length > 0 ? { weekStart } : null;
}

export type SaveSurveyResult = { status: "saved" } | { status: "not_asked" };

/** "맞았다/아니다" 응답을 저장한다. 물어본 기록이 있고 아직 응답하지 않은 주에만 저장한다. (내 기록만) */
export async function saveSurveyRecord(
  db: AnyPgDb,
  input: { userId: string; weekStart: string; matched: boolean },
): Promise<SaveSurveyResult> {
  const rows = await db
    .update(surveyResponses)
    .set({ matched: input.matched })
    .where(
      and(
        eq(surveyResponses.userId, input.userId),
        eq(surveyResponses.weekStart, input.weekStart),
        isNull(surveyResponses.matched),
      ),
    )
    .returning({ id: surveyResponses.id });
  return rows.length === 0 ? { status: "not_asked" } : { status: "saved" };
}
