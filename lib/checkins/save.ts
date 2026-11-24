import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { z } from "zod";
import { checkins, users } from "../../db/schema";
import { getFallbackSuggestion } from "../domain/fallback";
import { decideIntensity } from "../domain/intensity";
import type { CheckinInput, ExerciseLevel, Soreness, SuggestionSource } from "../domain/types";
import { suggestionRequestSchema } from "../suggestion/request";
import { kstDateKey } from "../suggestion/rate-limit";
import { validateSuggestion } from "../suggestion/validate";

// Design Ref: §4.4 — 로그인 사용자의 기록 저장 순서.
//  1) saveCheckin: 점수·강도를 서버가 다시 계산해 오늘 기록을 만들거나 수정(하루 1회, 한국 시간 기준 날짜), users.level도 갱신.
//  2) saveSuggestion: 화면이 보낸 제안을 그대로 믿지 않고 AI 응답과 같은 규칙으로 다시 검사해, 통과하면 그대로, 아니면 기본 문구로 바꿔 붙인다.
// Plan SC: 같은 날 다시 체크인하면 새 기록이 아니라 기존 기록을 수정하고, 이전 제안·평가·표시 여부는 지운다. (작업 14번)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

/** saveCheckin 입력 검사 (운동 수준·체크인 값은 제안 API와 같은 규칙, 소요 시간은 선택) */
export const saveCheckinSchema = suggestionRequestSchema.extend({
  /** 체크인 소요 시간(초). 이용 기록이라 없어도 저장된다. (측정은 작업 16번) */
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional(),
});

/** saveSuggestion 입력 검사. 제안 내용은 여기서 모양만 보고, 규칙 검사는 서버가 기록과 맞춰서 한다. */
export const saveSuggestionSchema = z.object({
  /** saveCheckin이 돌려준 기록 날짜 (자정을 넘겨도 같은 기록에 붙이기 위해) */
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(["ai", "fallback"]),
  suggestion: z.unknown(),
});

export type SaveCheckinInput = { userId: string; level: ExerciseLevel; checkin: CheckinInput; durationSeconds?: number };
export type SaveCheckinResult = { checkinDate: string; score: number; intensity: string };

/** 오늘(한국 시간) 기록을 만들거나, 이미 있으면 수정한다. 이전 제안·평가·표시 여부는 지운다. */
export async function saveCheckinRecord(db: AnyPgDb, input: SaveCheckinInput, now: Date = new Date()): Promise<SaveCheckinResult> {
  const { userId, level, checkin, durationSeconds } = input;
  // 화면이 알려 준 점수·강도는 쓰지 않고 서버가 다시 계산한다.
  const decided = decideIntensity(checkin);
  const checkinDate = kstDateKey(now);

  const fields = {
    sleepBand: checkin.sleepBand,
    sleepQuality: checkin.sleepQuality,
    fatigue: checkin.fatigue,
    soreness: checkin.soreness,
    mood: checkin.mood,
    yesterdayLoad: checkin.yesterdayLoad,
    level,
    score: decided.score,
    intensity: decided.intensity,
    durationSeconds: durationSeconds ?? null,
  };

  await db.transaction(async (tx) => {
    await tx
      .insert(checkins)
      .values({ userId, checkinDate, ...fields, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [checkins.userId, checkins.checkinDate],
        set: { ...fields, suggestion: null, suggestionSource: null, feedback: null, suggestionViewed: false, updatedAt: now },
      });
    await tx.update(users).set({ level }).where(eq(users.id, userId));
  });

  return { checkinDate, score: decided.score, intensity: decided.intensity };
}

export type SaveSuggestionInput = { userId: string; checkinDate: string; source: SuggestionSource; suggestion: unknown };
export type SaveSuggestionResult = { status: "saved"; source: SuggestionSource } | { status: "no_checkin" };

/** 제안을 다시 검사해서 해당 날짜의 내 기록에 붙인다. 규칙을 어기면 기본 문구와 fallback으로 바꿔 저장한다. */
export async function saveSuggestionRecord(db: AnyPgDb, input: SaveSuggestionInput): Promise<SaveSuggestionResult> {
  const { userId, checkinDate } = input;

  // 항상 세션의 계정 번호로만 찾는다. (다른 사람의 기록에는 붙일 수 없다)
  const [row] = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.userId, userId), eq(checkins.checkinDate, checkinDate)));
  if (!row) return { status: "no_checkin" };

  // 저장된 기록에서 강도와 쉬어야 할 부위를 다시 구해 규칙 검사의 기준으로 쓴다.
  const stored: CheckinInput = {
    sleepBand: row.sleepBand as CheckinInput["sleepBand"],
    sleepQuality: row.sleepQuality as CheckinInput["sleepQuality"],
    fatigue: row.fatigue as CheckinInput["fatigue"],
    soreness: row.soreness as Soreness,
    mood: row.mood as CheckinInput["mood"],
    yesterdayLoad: row.yesterdayLoad as CheckinInput["yesterdayLoad"],
  };
  const decided = decideIntensity(stored);

  const checked = validateSuggestion(input.suggestion, {
    level: row.level,
    intensity: decided.intensity,
    restParts: decided.restParts,
  });

  const suggestion = checked ?? getFallbackSuggestion(row.level, decided.intensity, decided.restParts);
  // 규칙 검사에서 떨어져 기본 문구로 바꿨다면 출처도 기본 문구로 적는다.
  const source: SuggestionSource = checked ? input.source : "fallback";

  await db
    .update(checkins)
    .set({ suggestion, suggestionSource: source, updatedAt: new Date() })
    .where(and(eq(checkins.userId, userId), eq(checkins.checkinDate, checkinDate)));

  return { status: "saved", source };
}
