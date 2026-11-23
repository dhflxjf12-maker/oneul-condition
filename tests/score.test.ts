// 점수 계산(lib/domain/score.ts) 자동 테스트.
// Design Ref: §8.2 — 점수·강도 기준 사례 중 점수 부분(사례 1·2·3·4·6·7·10)을 확인한다.
import { describe, expect, it } from 'vitest';
import { SCORE_MAX, SCORE_MIN } from '../lib/domain/constants';
import {
  calculateItemScores,
  calculateScore,
  createEmptySoreness,
  findMissingItems,
  getMaxSorenessPoint,
} from '../lib/domain/score';
import type { CheckinInput, Rating, SorenessPoint } from '../lib/domain/types';

/** 모두 최선인 입력(100점)을 기본으로, 바꿀 값만 덮어써서 쓴다. */
function makeInput(overrides: Partial<CheckinInput> = {}): CheckinInput {
  return {
    sleepBand: 4, // 7~9시간
    sleepQuality: 5,
    fatigue: 1,
    soreness: createEmptySoreness(),
    mood: 5,
    yesterdayLoad: 1, // 쉬었음
    ...overrides,
  };
}

describe('calculateScore — 기준 사례 (DESIGN §8.2)', () => {
  it('사례 1: 모두 최선이면 100점', () => {
    expect(calculateScore(makeInput())).toBe(100);
  });

  it('사례 2: 모두 최악이면 0점', () => {
    const worst = makeInput({
      sleepBand: 1,
      sleepQuality: 1,
      fatigue: 5,
      soreness: { ...createEmptySoreness(), lower: 5 },
      mood: 1,
      yesterdayLoad: 5,
    });
    expect(calculateScore(worst)).toBe(0);
  });

  it('사례 3: 합계 57.5는 올림해서 58점', () => {
    const middle = makeInput({
      sleepBand: 3, // 6~7시간
      sleepQuality: 3,
      fatigue: 3,
      soreness: { ...createEmptySoreness(), shoulder: 2 }, // 가장 높은 부위 2점
      mood: 3,
      yesterdayLoad: 3, // 보통
    });
    expect(calculateScore(middle)).toBe(58);
  });

  it('사례 4: 수면 5시간 미만이어도 나머지가 최선이면 80점', () => {
    expect(calculateScore(makeInput({ sleepBand: 1 }))).toBe(80);
  });

  it('사례 6: 같은 입력을 100번 계산해도 항상 같은 점수', () => {
    const input = makeInput({ sleepBand: 2, sleepQuality: 3, fatigue: 4, mood: 2, yesterdayLoad: 4 });
    const first = calculateScore(input);
    for (let i = 0; i < 100; i += 1) {
      expect(calculateScore(input)).toBe(first);
    }
  });

  it('사례 7: 근육통은 가장 높은 부위 점수로 계산한다 (어깨 4·하체 5 → 5점 기준)', () => {
    const input = makeInput({ soreness: { ...createEmptySoreness(), shoulder: 4, lower: 5 } });
    expect(getMaxSorenessPoint(input.soreness)).toBe(5);
    expect(calculateItemScores(input).soreness).toBe(0);
    // 근육통 항목만 100 → 0 이 되므로 비중 15점이 빠진다
    expect(calculateScore(input)).toBe(85);
  });
});

describe('calculateScore — 반올림 (DESIGN §10, 정수 계산)', () => {
  // 수면의 질만 바꾸면 합계의 소수 부분이 .25 / .5 / .75 가 된다.
  it('x.25는 버린다 (96.25 → 96)', () => {
    expect(calculateScore(makeInput({ sleepQuality: 4 }))).toBe(96);
  });

  it('x.5는 올린다 (92.5 → 93)', () => {
    expect(calculateScore(makeInput({ sleepQuality: 3 }))).toBe(93);
  });

  it('x.75는 올린다 (88.75 → 89)', () => {
    expect(calculateScore(makeInput({ sleepQuality: 2 }))).toBe(89);
  });
});

describe('calculateScore — 모든 조합', () => {
  // 조합이 많아서 expect를 수만 번 부르면 느려지므로, 어긋난 경우만 모아서 한 번에 확인한다.
  it('어떤 입력이든 0~100 사이의 정수가 나온다', { timeout: 30000 }, () => {
    const ratings: Rating[] = [1, 2, 3, 4, 5];
    const sorenessPoints: SorenessPoint[] = [0, 1, 2, 3, 4, 5];
    const violations: number[] = [];
    let count = 0;
    for (const sleepBand of ratings) {
      for (const sleepQuality of ratings) {
        for (const fatigue of ratings) {
          for (const mood of ratings) {
            for (const yesterdayLoad of ratings) {
              for (const point of sorenessPoints) {
                const score = calculateScore({
                  sleepBand,
                  sleepQuality,
                  fatigue,
                  soreness: { ...createEmptySoreness(), back: point },
                  mood,
                  yesterdayLoad,
                });
                if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) violations.push(score);
                count += 1;
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(count).toBe(5 * 5 * 5 * 5 * 5 * 6);
  });
});

describe('calculateScore — 범위를 벗어난 값', () => {
  it('1~5 범위를 벗어난 단계는 오류를 낸다', () => {
    expect(() => calculateScore(makeInput({ mood: 6 as Rating }))).toThrow(RangeError);
    expect(() => calculateScore(makeInput({ fatigue: 0 as Rating }))).toThrow(RangeError);
  });

  it('근육통이 0~5 범위를 벗어나면 오류를 낸다', () => {
    const bad = { ...createEmptySoreness(), arm: 6 as SorenessPoint };
    expect(() => calculateScore(makeInput({ soreness: bad }))).toThrow(RangeError);
  });
});

describe('findMissingItems — 빠진 항목 검사', () => {
  it('모두 채워져 있으면 빈 목록', () => {
    expect(findMissingItems(makeInput())).toEqual([]);
  });

  it('근육통은 없어도 빠진 항목으로 보지 않는다', () => {
    const withoutSoreness: Partial<CheckinInput> = makeInput();
    delete withoutSoreness.soreness;
    expect(findMissingItems(withoutSoreness)).toEqual([]);
  });

  it('비어 있는 필수 항목 이름을 화면 순서대로 알려 준다', () => {
    expect(findMissingItems({ sleepBand: 4, fatigue: 2, yesterdayLoad: 3 })).toEqual(['sleepQuality', 'mood']);
  });

  it('아무것도 입력하지 않으면 필수 5개가 모두 빠진 항목', () => {
    expect(findMissingItems({})).toEqual(['sleepBand', 'sleepQuality', 'fatigue', 'mood', 'yesterdayLoad']);
  });
});
