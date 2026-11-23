// 체크인 입력값으로 오늘의 컨디션 점수(0~100)를 계산하는 순수 함수 모음.
// Design Ref: §2.2 — 점수는 AI가 아니라 고정 공식으로 계산하고, 화면과 서버가 같은 코드를 쓴다.
// Design Ref: §10 — 정수로만 계산한다(비중을 정수 %로 곱해 더한 뒤 100으로 나누고 0.5는 올림).
// Plan SC: 같은 입력이면 항상 같은 점수가 나온다. (작업 2번)
import {
  CHECKIN_ITEM_KEYS,
  FATIGUE_SCORES,
  ITEM_WEIGHT_PERCENT,
  MOOD_SCORES,
  SLEEP_BAND_SCORES,
  SLEEP_QUALITY_SCORES,
  SORENESS_MAX_POINT,
  SORENESS_MIN_POINT,
  SORENESS_PARTS,
  SORENESS_SCORE_PER_POINT,
  YESTERDAY_LOAD_SCORES,
} from './constants';
import type { CheckinInput, Soreness } from './types';

/** 체크인 항목 이름 (sleepBand, sleepQuality, fatigue, soreness, mood, yesterdayLoad) */
export type CheckinItemKey = (typeof CHECKIN_ITEM_KEYS)[number];

/**
 * 반드시 골라야 하는 5개 항목.
 * 근육통은 고르지 않은 부위를 0점(통증 없음)으로 보므로 여기에 넣지 않는다.
 */
export const REQUIRED_ITEM_KEYS = CHECKIN_ITEM_KEYS.filter(
  (key): key is Exclude<CheckinItemKey, 'soreness'> => key !== 'soreness',
);

/** 모든 부위가 0점(통증 없음)인 근육통 값을 만든다. */
export function createEmptySoreness(): Soreness {
  return {
    shoulder: 0,
    back: 0,
    arm: 0,
    chest: 0,
    abdomen: 0,
    lower: 0,
  };
}

/**
 * 아직 입력하지 않은(비어 있는) 필수 항목의 이름을 돌려준다.
 * 비어 있는 항목이 하나라도 있으면 점수를 내지 않고, 이 목록으로 빠진 항목을 알려 준다.
 * 근육통은 필수가 아니라서 검사하지 않는다.
 */
export function findMissingItems(input: Partial<CheckinInput>): Exclude<CheckinItemKey, 'soreness'>[] {
  return REQUIRED_ITEM_KEYS.filter((key) => input[key] === undefined || input[key] === null);
}

/** 1~5 단계 환산표에서 항목 점수를 찾는다. 범위를 벗어난 값이면 오류를 낸다. */
function lookupTableScore(table: readonly number[], rating: number, itemName: string): number {
  const score = table[rating - 1];
  if (!Number.isInteger(rating) || score === undefined) {
    throw new RangeError(`${itemName} 값이 1~${table.length} 범위를 벗어났습니다: ${rating}`);
  }
  return score;
}

/** 근육통 6부위 중 가장 높은 점수를 구한다. 범위를 벗어난 값이면 오류를 낸다. */
export function getMaxSorenessPoint(soreness: Soreness): number {
  let max = SORENESS_MIN_POINT;
  for (const part of SORENESS_PARTS) {
    const point = soreness[part];
    if (!Number.isInteger(point) || point < SORENESS_MIN_POINT || point > SORENESS_MAX_POINT) {
      throw new RangeError(
        `근육통(${part}) 값이 ${SORENESS_MIN_POINT}~${SORENESS_MAX_POINT} 범위를 벗어났습니다: ${point}`,
      );
    }
    if (point > max) max = point;
  }
  return max;
}

/** 항목별 점수(0~100)를 환산표로 구한다. */
export function calculateItemScores(input: CheckinInput): Record<CheckinItemKey, number> {
  return {
    sleepBand: lookupTableScore(SLEEP_BAND_SCORES, input.sleepBand, '수면 시간'),
    sleepQuality: lookupTableScore(SLEEP_QUALITY_SCORES, input.sleepQuality, '수면의 질'),
    fatigue: lookupTableScore(FATIGUE_SCORES, input.fatigue, '피로도'),
    soreness: 100 - getMaxSorenessPoint(input.soreness) * SORENESS_SCORE_PER_POINT,
    mood: lookupTableScore(MOOD_SCORES, input.mood, '기분'),
    yesterdayLoad: lookupTableScore(YESTERDAY_LOAD_SCORES, input.yesterdayLoad, '어제 운동량'),
  };
}

/**
 * 오늘의 컨디션 점수(0~100 정수)를 계산한다.
 * 항목 점수 × 정수 % 비중을 모두 더한 합계를 100으로 나누고, 정확히 0.5이면 올린다.
 * (소수 곱셈 오차로 57.5가 57이 되는 일을 막기 위해 정수로만 계산한다.)
 */
export function calculateScore(input: CheckinInput): number {
  const itemScores = calculateItemScores(input);
  let weightedSum = 0;
  for (const key of CHECKIN_ITEM_KEYS) {
    weightedSum += itemScores[key] * ITEM_WEIGHT_PERCENT[key];
  }
  // (합계 + 50) ÷ 100 의 몫 = 0.5 이상이면 올림, 미만이면 버림
  return Math.floor((weightedSum + 50) / 100);
}
