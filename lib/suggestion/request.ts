import { z } from "zod";
import type { CheckinInput, ExerciseLevel } from "../domain/types";

// Design Ref: §4.2 — 요청 입력 검사(Zod). 이메일 등 식별 정보는 받지 않는다.

const rating = z.number().int().min(1).max(5);
const sorenessPoint = z.number().int().min(0).max(5);

export const suggestionRequestSchema = z.object({
  level: z.enum(["hobby", "athlete"]),
  checkin: z.object({
    sleepBand: rating,
    sleepQuality: rating,
    fatigue: rating,
    soreness: z.object({
      shoulder: sorenessPoint,
      back: sorenessPoint,
      arm: sorenessPoint,
      chest: sorenessPoint,
      abdomen: sorenessPoint,
      lower: sorenessPoint,
    }),
    mood: rating,
    yesterdayLoad: rating,
  }),
});

export type SuggestionRequest = { level: ExerciseLevel; checkin: CheckinInput };

/** 요청 본문을 검사한다. 통과하면 값을, 아니면 null. */
export function parseSuggestionRequest(body: unknown): SuggestionRequest | null {
  const parsed = suggestionRequestSchema.safeParse(body);
  // Zod가 범위(1~5, 0~5)와 정수를 확인했으므로 도메인 타입으로 좁혀도 안전하다.
  return parsed.success ? (parsed.data as SuggestionRequest) : null;
}
