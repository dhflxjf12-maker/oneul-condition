// AI가 실패·지연·한도 초과이거나 규칙을 어겼을 때 대신 보여 주는 "기본 제안 문구"를 만드는 순수 함수.
// Design Ref: §4.2 — 기본 문구는 쉬어야 할 부위를 끼워 넣는 틀로 만들고, 운동 수준별 시간 범위를 지킨다.
// Design Ref: §2.2 — 근육통 6부위가 모두 4점 이상(휴식 고정)이면 AI 없이 기본 회복 안내를 보여 준다.
// Plan SC: AI가 실패해도 항상 규칙을 지키는 제안이 나온다. (작업 4번)
import {
  EXERCISE_TYPE_LABELS,
  REST_ACTIVITY_MAX_MINUTES,
  SORENESS_PARTS,
  SORENESS_PART_LABELS,
  SUGGESTION_MINUTES_RANGE,
} from './constants';
import type { ExerciseLevel, ExerciseType, Intensity, Suggestion, SorenessPart, TargetPart } from './types';

/** 근육통 6부위가 모두 4점 이상일 때 보여 주는 기본 회복 안내 문구 (AI를 쓰지 않음) */
export const REST_LOCK_MESSAGE = '오늘은 쉬면서 가벼운 스트레칭과 충분한 수면·수분 섭취를 권해요';

/** 강도별 말머리 */
const INTENSITY_WORDS = {
  light: '가볍게',
  moderate: '적당한 강도로',
  high: '힘 있게',
} as const;

/** 강도별 기본 운동 종류 (하체를 쉬어야 하면 근력으로 바꾼다) */
const FALLBACK_TYPE_BY_INTENSITY = {
  rest: 'recovery',
  light: 'cardio',
  moderate: 'cardio',
  high: 'strength',
} as const satisfies Record<Intensity, ExerciseType>;

/** 5분 단위로 맞춘 기본 운동 시간(분). 항상 수준·강도별 범위 안에 든다. */
export function getFallbackMinutes(level: ExerciseLevel, intensity: Intensity): number {
  if (intensity === 'rest') return REST_ACTIVITY_MAX_MINUTES;
  const { min, max } = SUGGESTION_MINUTES_RANGE[level][intensity];
  const rounded = Math.round((min + max) / 2 / 5) * 5; // 범위의 가운데를 5분 단위로
  return Math.min(max, Math.max(min, rounded));
}

/** 부위 목록을 "어깨·등" 처럼 이름으로 이어 붙인다. */
function joinPartLabels(parts: readonly SorenessPart[]): string {
  return parts.map((part) => SORENESS_PART_LABELS[part]).join('·');
}

/**
 * 기본 제안 한 건을 만든다.
 * @param level 운동 수준(애호가/선수)
 * @param intensity 이미 정해진 최종 강도 (이 강도는 바꾸지 않는다)
 * @param restParts 쉬어야 할 부위 (근육통 4점 이상 부위, 없으면 빈 목록)
 */
export function getFallbackSuggestion(
  level: ExerciseLevel,
  intensity: Intensity,
  restParts: readonly SorenessPart[] = [],
): Suggestion {
  // 입력을 화면 순서로 정리해서(중복 제거) 복사한다. 원래 배열은 건드리지 않는다.
  const rest = SORENESS_PARTS.filter((part) => restParts.includes(part));
  const usableParts = SORENESS_PARTS.filter((part) => !rest.includes(part));
  const minutes = getFallbackMinutes(level, intensity);

  // 6부위 모두 쉬어야 하면 AI 없이 기본 회복 안내 (사용할 부위 없음)
  if (usableParts.length === 0) {
    return {
      type: 'recovery',
      minutes: REST_ACTIVITY_MAX_MINUTES,
      targetParts: [],
      restParts: rest,
      message: REST_LOCK_MESSAGE,
    };
  }

  // 쉬어야 할 부위가 없으면 전신, 있으면 쉬지 않는 부위만 사용 부위로 적는다. (전신과 쉬는 부위는 함께 못 씀)
  const targetParts: TargetPart[] = rest.length === 0 ? ['whole'] : usableParts;
  const restSentence = rest.length > 0 ? ` 쉬어야 할 부위: ${joinPartLabels(rest)}.` : '';
  const partsSentence = rest.length > 0 ? ` 사용 부위: ${joinPartLabels(usableParts)}.` : '';

  if (intensity === 'rest') {
    return {
      type: 'recovery',
      minutes,
      targetParts,
      restParts: rest,
      message: `오늘은 쉬는 날이에요. 스트레칭이나 가벼운 산책을 ${minutes}분 이내로만 하세요.${restSentence}`,
    };
  }

  // 하체를 쉬어야 하면 유산소(걷기·달리기) 대신 근력 위주로 안내한다.
  const type: ExerciseType = rest.includes('lower') ? 'strength' : FALLBACK_TYPE_BY_INTENSITY[intensity];
  return {
    type,
    minutes,
    targetParts,
    restParts: rest,
    message: `${INTENSITY_WORDS[intensity]} ${EXERCISE_TYPE_LABELS[type]} ${minutes}분을 추천해요.${partsSentence}${restSentence}`,
  };
}
