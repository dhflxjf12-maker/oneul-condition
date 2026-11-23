// 점수로 오늘의 운동 강도(휴식·가벼움·보통·높음)를 정하는 순수 함수 모음.
// Design Ref: §2.2 — 강도는 AI가 아니라 고정 규칙으로 정하고, AI는 정해진 강도 안에서 제안만 만든다.
// Design Ref: §4.2 — 점수 구간 → 상한 규칙 → 휴식 고정 순서로 적용한다.
// Plan SC: 수면 5시간 미만·근육통 5점이면 "보통" 상한, 근육통 6부위 모두 4점 이상이면 "휴식" 고정. (작업 3번)
import {
  CAP_INTENSITY,
  INTENSITY_MIN_SCORE,
  INTENSITY_ORDER,
  REST_RECOMMENDED_BELOW_SCORE,
  SCORE_MAX,
  SCORE_MIN,
  SLEEP_CAP_MAX_BAND,
  SORENESS_CAP_POINT,
  SORENESS_EXCLUDE_POINT,
  SORENESS_PARTS,
  SORENESS_REST_LOCK_POINT,
} from './constants';
import { calculateScore, getMaxSorenessPoint } from './score';
import type { CheckinInput, Intensity, Soreness, SorenessPart } from './types';

/** 강도 결정 결과 */
export interface IntensityResult {
  /** 오늘의 컨디션 점수 (0~100) */
  score: number;
  /** 최종 강도 (상한·고정 규칙까지 적용한 값) */
  intensity: Intensity;
  /** 점수 구간만으로 정한 기본 강도 */
  baseIntensity: Intensity;
  /** 점수가 40 미만이라 "휴식 권장" 문구를 보여 줘야 하는지 */
  restRecommended: boolean;
  /** 근육통 6부위가 모두 4점 이상이라 강도를 "휴식"으로 고정했는지 (이때는 AI를 쓰지 않는다) */
  restLocked: boolean;
  /** 상한 규칙(수면 5시간 미만·근육통 5점) 때문에 강도가 실제로 낮아졌는지 */
  cappedByRule: boolean;
  /** 쉬어야 할 부위 = 근육통 4점 이상인 부위 (없으면 빈 목록, 화면 순서) */
  restParts: SorenessPart[];
}

/** 강도 단계 순서에서의 위치 (클수록 센 강도) */
function intensityRank(intensity: Intensity): number {
  return INTENSITY_ORDER.indexOf(intensity);
}

/** 점수 구간만으로 기본 강도를 정한다. (0~39 휴식, 40~59 가벼움, 60~79 보통, 80~100 높음) */
export function getBaseIntensity(score: number): Intensity {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
    throw new RangeError(`점수는 ${SCORE_MIN}~${SCORE_MAX} 사이의 정수여야 합니다: ${score}`);
  }
  // 센 강도부터 확인해서, 점수가 시작값 이상이면 그 강도로 정한다.
  for (let i = INTENSITY_ORDER.length - 1; i >= 0; i -= 1) {
    const intensity = INTENSITY_ORDER[i];
    if (score >= INTENSITY_MIN_SCORE[intensity]) return intensity;
  }
  return 'rest';
}

/** 쉬어야 할 부위: 근육통이 4점 이상인 부위 (화면 순서, 없으면 빈 목록) */
export function getRestParts(soreness: Soreness): SorenessPart[] {
  getMaxSorenessPoint(soreness); // 범위를 벗어난 값이면 여기서 오류를 낸다
  return SORENESS_PARTS.filter((part) => soreness[part] >= SORENESS_EXCLUDE_POINT);
}

/** 근육통 6부위가 모두 4점 이상이면 참 → 강도를 "휴식"으로 고정한다. */
export function isRestLocked(soreness: Soreness): boolean {
  getMaxSorenessPoint(soreness); // 범위를 벗어난 값이면 여기서 오류를 낸다
  return SORENESS_PARTS.every((part) => soreness[part] >= SORENESS_REST_LOCK_POINT);
}

/** 상한 조건: 수면 5시간 미만이거나, 근육통 5점인 부위가 하나라도 있으면 참 */
export function isCapConditionMet(input: CheckinInput): boolean {
  return input.sleepBand <= SLEEP_CAP_MAX_BAND || getMaxSorenessPoint(input.soreness) >= SORENESS_CAP_POINT;
}

/** 강도가 상한("보통")보다 세면 상한으로 낮춘다. 낮은 강도는 그대로 둔다. */
export function applyIntensityCap(intensity: Intensity): Intensity {
  return intensityRank(intensity) > intensityRank(CAP_INTENSITY) ? CAP_INTENSITY : intensity;
}

/**
 * 체크인 입력으로 오늘의 점수·강도·쉬어야 할 부위를 정한다.
 * 순서: ① 점수 구간으로 기본 강도 → ② 상한 규칙("보통"을 넘지 않음) → ③ 6부위 모두 4점 이상이면 "휴식" 고정
 */
export function decideIntensity(input: CheckinInput): IntensityResult {
  const score = calculateScore(input);
  const baseIntensity = getBaseIntensity(score);

  const restLocked = isRestLocked(input.soreness);
  const cappedIntensity = isCapConditionMet(input) ? applyIntensityCap(baseIntensity) : baseIntensity;
  const intensity: Intensity = restLocked ? 'rest' : cappedIntensity;

  return {
    score,
    intensity,
    baseIntensity,
    restRecommended: score < REST_RECOMMENDED_BELOW_SCORE,
    restLocked,
    cappedByRule: intensityRank(cappedIntensity) < intensityRank(baseIntensity),
    restParts: getRestParts(input.soreness),
  };
}
