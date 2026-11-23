import { z } from "zod";
import { SORENESS_PARTS, SUGGESTION_MINUTES_RANGE, REST_ACTIVITY_MAX_MINUTES } from "../domain/constants";
import type { ExerciseLevel, Intensity, Suggestion, SorenessPart } from "../domain/types";

// Design Ref: §4.2 6단계 — AI 응답 검사(Zod + 규칙). 모두 통과해야 AI 제안을 쓰고, 하나라도 어기면 기본 문구로 바꾼다.
// Plan SC: AI는 점수와 강도를 바꾸지 못한다. 규칙을 어긴 제안은 화면에 나가지 않는다. (작업 9번)

/** 진단·치료·병명 표현 금지어 (PRD: 의학적 진단이나 치료를 말하지 않는다) */
export const FORBIDDEN_WORDS = [
  "진단",
  "치료",
  "처방",
  "병명",
  "질환",
  "질병",
  "증후군",
  "디스크",
  "염좌",
  "골절",
  "인대",
  "파열",
  "부상 부위",
  "약을",
  "약물",
  "완치",
] as const;

/** 문구 길이 상한 (너무 긴 응답 방지) */
export const MAX_MESSAGE_LENGTH = 200;

const part = z.enum(["shoulder", "back", "arm", "chest", "abdomen", "lower"]);

const rawSuggestionSchema = z.object({
  type: z.enum(["cardio", "strength", "recovery"]),
  minutes: z.number().int(),
  targetParts: z.array(z.union([part, z.literal("whole")])).min(1),
  restParts: z.array(part),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** 같은 부위 집합인지(순서·중복 무시) */
function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  return setA.size === setB.size && [...setA].every((item) => setB.has(item));
}

export type ValidationContext = {
  level: ExerciseLevel;
  /** 서버가 다시 계산한 최종 강도 (AI는 이를 바꾸지 못한다) */
  intensity: Intensity;
  /** 근육통 4점 이상인 부위 — AI의 restParts와 정확히 같아야 한다 */
  restParts: readonly SorenessPart[];
};

/** 규칙을 모두 지키면 제안을, 하나라도 어기면 null을 돌려준다. */
export function validateSuggestion(raw: unknown, context: ValidationContext): Suggestion | null {
  const parsed = rawSuggestionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const suggestion = parsed.data;

  // 시간(분): 강도별 범위 안. 휴식 강도에서는 회복 활동만, 짧게.
  if (context.intensity === "rest") {
    if (suggestion.type !== "recovery") return null;
    if (suggestion.minutes < 1 || suggestion.minutes > REST_ACTIVITY_MAX_MINUTES) return null;
  } else {
    const { min, max } = SUGGESTION_MINUTES_RANGE[context.level][context.intensity];
    if (suggestion.minutes < min || suggestion.minutes > max) return null;
  }

  // 쉬어야 할 부위는 근육통 4점 이상 부위와 정확히 같아야 한다.
  if (!sameSet(suggestion.restParts, context.restParts)) return null;

  // 사용 부위: 쉬어야 할 부위와 겹치면 거부, 쉬어야 할 부위가 있으면 전신은 쓸 수 없다.
  const hasRest = context.restParts.length > 0;
  for (const target of suggestion.targetParts) {
    if (target === "whole") {
      if (hasRest) return null;
    } else if (context.restParts.includes(target)) {
      return null;
    }
  }
  if (suggestion.targetParts.includes("whole") && suggestion.targetParts.length > 1) return null;

  // 금지어가 있으면 거부
  if (FORBIDDEN_WORDS.some((word) => suggestion.message.includes(word))) return null;

  // 쉬어야 할 부위를 그대로 유지해서 돌려준다 (순서는 화면 순서로 정리).
  return {
    type: suggestion.type,
    minutes: suggestion.minutes,
    targetParts: [...new Set(suggestion.targetParts)],
    restParts: SORENESS_PARTS.filter((p) => context.restParts.includes(p)),
    message: suggestion.message,
  };
}
