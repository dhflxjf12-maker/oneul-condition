import {
  CHECKIN_ITEM_LABELS,
  INTENSITY_LABELS,
  SORENESS_PARTS,
  SORENESS_PART_LABELS,
  SUGGESTION_MINUTES_RANGE,
  REST_ACTIVITY_MAX_MINUTES,
  LEVEL_LABELS,
} from "../domain/constants";
import type { CheckinInput, ExerciseLevel, Intensity, SorenessPart } from "../domain/types";
import { FORBIDDEN_WORDS, MAX_MESSAGE_LENGTH } from "./validate";

// Design Ref: §4.2 — AI에게는 체크인 값과 운동 수준, 이미 정해진 강도만 알려 준다. 이메일 등 식별 정보는 보내지 않는다.

/** AI에게 주는 고정 지시문 (같은 금지어 규칙을 AI에게도 알린다) */
export const SYSTEM_PROMPT = [
  "당신은 운동 계획을 돕는 코치입니다. 사용자의 오늘 컨디션 체크인을 바탕으로 오늘의 운동을 한국어로 제안합니다.",
  "점수와 운동 강도는 이미 정해져 있습니다. 강도를 바꾸거나 점수를 다시 말하지 마세요.",
  "반드시 JSON 객체 하나만 출력하세요. 설명이나 코드 블록 표시는 쓰지 마세요.",
  `JSON 필드: type("cardio"|"strength"|"recovery"), minutes(정수), targetParts(배열: "shoulder","back","arm","chest","abdomen","lower" 또는 ["whole"]), restParts(배열), message(문자열, ${MAX_MESSAGE_LENGTH}자 이하, 존댓말 한두 문장)`,
  `의학적 진단·치료·병명을 말하지 마세요. 다음 단어는 쓰지 마세요: ${FORBIDDEN_WORDS.join(", ")}.`,
].join("\n");

/** 사용자 입력 한 건을 AI에게 보낼 문장으로 만든다. */
export function buildUserPrompt(args: {
  level: ExerciseLevel;
  intensity: Exclude<Intensity, "rest"> | "rest";
  input: CheckinInput;
  restParts: readonly SorenessPart[];
}): string {
  const { level, intensity, input, restParts } = args;
  const usable = SORENESS_PARTS.filter((part) => !restParts.includes(part));

  const minutesRule =
    intensity === "rest"
      ? `minutes는 1~${REST_ACTIVITY_MAX_MINUTES} 사이, type은 "recovery"만 가능합니다.`
      : `minutes는 ${SUGGESTION_MINUTES_RANGE[level][intensity].min}~${SUGGESTION_MINUTES_RANGE[level][intensity].max} 사이여야 합니다.`;

  const lines = [
    `운동 수준: ${LEVEL_LABELS[level]}`,
    `오늘의 운동 강도(변경 불가): ${INTENSITY_LABELS[intensity]}`,
    `${CHECKIN_ITEM_LABELS.sleepBand}: ${input.sleepBand}단계(1~5), ${CHECKIN_ITEM_LABELS.sleepQuality}: ${input.sleepQuality}/5, ${CHECKIN_ITEM_LABELS.fatigue}: ${input.fatigue}/5, ${CHECKIN_ITEM_LABELS.mood}: ${input.mood}/5, ${CHECKIN_ITEM_LABELS.yesterdayLoad}: ${input.yesterdayLoad}단계(1=쉬었음~5=매우 강함)`,
    `근육통(0~5): ${SORENESS_PARTS.map((part) => `${SORENESS_PART_LABELS[part]} ${input.soreness[part]}`).join(", ")}`,
    "",
    minutesRule,
    restParts.length > 0
      ? `restParts는 정확히 [${restParts.map((p) => `"${p}"`).join(", ")}] 이어야 하고, targetParts에는 이 부위를 넣지 마세요. 사용 가능한 부위: ${usable.map((p) => `"${p}"`).join(", ")}. "whole"은 쓰지 마세요.`
      : `restParts는 빈 배열 []이어야 합니다. targetParts는 부위 목록 또는 ["whole"]입니다.`,
  ];
  return lines.join("\n");
}
