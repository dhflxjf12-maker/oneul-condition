// 강도 결정(lib/domain/intensity.ts) 자동 테스트.
// Design Ref: §8.2 — 사례 1·2·4·5·7·8·9와 상한·고정 규칙을 확인한다.
import { describe, expect, it } from 'vitest';
import { SORENESS_PARTS } from '../lib/domain/constants';
import {
  applyIntensityCap,
  decideIntensity,
  getBaseIntensity,
  getRestParts,
  isCapConditionMet,
  isRestLocked,
} from '../lib/domain/intensity';
import { createEmptySoreness } from '../lib/domain/score';
import type { CheckinInput, Intensity, Rating, Soreness, SorenessPoint } from '../lib/domain/types';

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

/** 6부위 모두 같은 점수인 근육통 값을 만든다. */
function allParts(point: SorenessPoint): Soreness {
  return { shoulder: point, back: point, arm: point, chest: point, abdomen: point, lower: point };
}

describe('getBaseIntensity — 점수 경계값 (DESIGN 사례 8)', () => {
  const cases: [number, Intensity][] = [
    [0, 'rest'],
    [39, 'rest'],
    [40, 'light'],
    [59, 'light'],
    [60, 'moderate'],
    [79, 'moderate'],
    [80, 'high'],
    [100, 'high'],
  ];
  it.each(cases)('점수 %i → %s', (score, expected) => {
    expect(getBaseIntensity(score)).toBe(expected);
  });

  it('0~100 밖이거나 정수가 아닌 점수는 오류를 낸다', () => {
    expect(() => getBaseIntensity(-1)).toThrow(RangeError);
    expect(() => getBaseIntensity(101)).toThrow(RangeError);
    expect(() => getBaseIntensity(59.5)).toThrow(RangeError);
  });
});

describe('쉬어야 할 부위 / 휴식 고정 / 상한 조건', () => {
  it('근육통 4점 이상인 부위만 쉬어야 할 부위 (화면 순서)', () => {
    const soreness: Soreness = { ...createEmptySoreness(), lower: 5, shoulder: 4, back: 3 };
    expect(getRestParts(soreness)).toEqual(['shoulder', 'lower']);
  });

  it('아픈 곳이 없으면 쉬어야 할 부위는 빈 목록', () => {
    expect(getRestParts(createEmptySoreness())).toEqual([]);
  });

  it('6부위가 모두 4점 이상이어야 휴식 고정 (5부위만으로는 고정 안 됨)', () => {
    expect(isRestLocked(allParts(4))).toBe(true);
    expect(isRestLocked(allParts(5))).toBe(true);
    expect(isRestLocked({ ...allParts(4), arm: 3 })).toBe(false);
    expect(isRestLocked(createEmptySoreness())).toBe(false);
  });

  it('상한 조건: 수면 5시간 미만이거나 근육통 5점이 있을 때만', () => {
    expect(isCapConditionMet(makeInput({ sleepBand: 1 }))).toBe(true);
    expect(isCapConditionMet(makeInput({ soreness: { ...createEmptySoreness(), back: 5 } }))).toBe(true);
    expect(isCapConditionMet(makeInput({ sleepBand: 2 }))).toBe(false); // 5~6시간은 해당 없음
    expect(isCapConditionMet(makeInput({ soreness: allParts(4) }))).toBe(false); // 4점은 상한 조건이 아님
  });

  it('상한은 "보통"보다 센 강도만 낮춘다', () => {
    expect(applyIntensityCap('high')).toBe('moderate');
    expect(applyIntensityCap('moderate')).toBe('moderate');
    expect(applyIntensityCap('light')).toBe('light');
    expect(applyIntensityCap('rest')).toBe('rest');
  });

  it('범위를 벗어난 근육통 값은 오류를 낸다', () => {
    const bad = { ...createEmptySoreness(), arm: 6 as SorenessPoint };
    expect(() => getRestParts(bad)).toThrow(RangeError);
    expect(() => isRestLocked(bad)).toThrow(RangeError);
  });
});

describe('decideIntensity — 기준 사례 (DESIGN §8.2)', () => {
  it('사례 1: 모두 최선이면 100점·높음, 규칙이 적용되지 않음', () => {
    const result = decideIntensity(makeInput());
    expect(result).toEqual({
      score: 100,
      intensity: 'high',
      baseIntensity: 'high',
      restRecommended: false,
      restLocked: false,
      cappedByRule: false,
      restParts: [],
    });
  });

  it('사례 2: 모두 최악이면 0점·휴식, 휴식 권장 표시', () => {
    const result = decideIntensity(
      makeInput({
        sleepBand: 1,
        sleepQuality: 1,
        fatigue: 5,
        soreness: { ...createEmptySoreness(), lower: 5 },
        mood: 1,
        yesterdayLoad: 5,
      }),
    );
    expect(result.score).toBe(0);
    expect(result.intensity).toBe('rest');
    expect(result.restRecommended).toBe(true);
    expect(result.restLocked).toBe(false);
    expect(result.restParts).toEqual(['lower']);
  });

  it('사례 4: 점수 80(기본 높음)이어도 수면 5시간 미만이면 "보통"으로 낮춘다', () => {
    const result = decideIntensity(makeInput({ sleepBand: 1 }));
    expect(result.score).toBe(80);
    expect(result.baseIntensity).toBe('high');
    expect(result.intensity).toBe('moderate');
    expect(result.cappedByRule).toBe(true);
  });

  it('사례 5·9: 근육통 6부위가 모두 4점이면 점수와 관계없이 휴식 고정 (AI 미사용 대상)', () => {
    const result = decideIntensity(makeInput({ soreness: allParts(4) }));
    expect(result.score).toBe(88); // 근육통 항목만 20점이라 나머지는 최선
    expect(result.baseIntensity).toBe('high');
    expect(result.intensity).toBe('rest');
    expect(result.restLocked).toBe(true);
    expect(result.restParts).toEqual([...SORENESS_PARTS]);
    expect(result.cappedByRule).toBe(false); // 4점은 상한 조건이 아니라 "고정"으로만 처리
  });

  it('사례 9: 6부위가 모두 5점이어도 휴식 고정', () => {
    const result = decideIntensity(makeInput({ soreness: allParts(5) }));
    expect(result.intensity).toBe('rest');
    expect(result.restLocked).toBe(true);
  });

  it('사례 9 경계: 5부위만 4점이고 한 부위가 3점이면 고정하지 않는다', () => {
    const result = decideIntensity(makeInput({ soreness: { ...allParts(4), arm: 3 } }));
    expect(result.restLocked).toBe(false);
    expect(result.restParts).toHaveLength(5);
    expect(result.score).toBe(88);
    expect(result.intensity).toBe('high'); // 4점은 상한 조건이 아니므로 점수 구간 그대로
  });

  it('사례 7: 어깨 4·하체 5 → 둘 다 쉬어야 할 부위, 하체 5점이라 상한 "보통"', () => {
    const result = decideIntensity(makeInput({ soreness: { ...createEmptySoreness(), shoulder: 4, lower: 5 } }));
    expect(result.restParts).toEqual(['shoulder', 'lower']);
    expect(result.score).toBe(85);
    expect(result.baseIntensity).toBe('high');
    expect(result.intensity).toBe('moderate');
    expect(result.cappedByRule).toBe(true);
  });

  it('상한 조건이 있어도 이미 낮은 강도는 그대로 두고 "낮아졌다"고 표시하지 않는다', () => {
    // 수면 5시간 미만 + 점수 52(가벼움)
    const result = decideIntensity(makeInput({ sleepBand: 1, sleepQuality: 3, fatigue: 3, mood: 3, yesterdayLoad: 3 }));
    expect(result.score).toBe(52);
    expect(result.baseIntensity).toBe('light');
    expect(result.intensity).toBe('light');
    expect(result.cappedByRule).toBe(false);
  });

  it('수면 5~6시간은 상한이 적용되지 않는다', () => {
    const result = decideIntensity(makeInput({ sleepBand: 2 }));
    expect(result.score).toBe(86); // 수면 시간 30점 → 70점 감소 × 비중 20% = 14점 감소
    expect(result.intensity).toBe('high');
    expect(result.cappedByRule).toBe(false);
  });

  it('같은 입력이면 100번 반복해도 결과가 같다', () => {
    const input = makeInput({ sleepBand: 1, soreness: { ...createEmptySoreness(), chest: 4 } });
    const first = decideIntensity(input);
    for (let i = 0; i < 100; i += 1) {
      expect(decideIntensity(input)).toEqual(first);
    }
  });
});

describe('decideIntensity — 모든 조합에서 지켜져야 하는 규칙', () => {
  const ratings: Rating[] = [1, 2, 3, 4, 5];
  const sorenessSamples: Soreness[] = [
    createEmptySoreness(),
    { ...createEmptySoreness(), shoulder: 4 },
    { ...createEmptySoreness(), lower: 5 },
    allParts(3),
    allParts(4),
    allParts(5),
  ];

  // 조합이 많아서 expect를 수만 번 부르면 느려지므로, 어긋난 경우만 모아서 한 번에 확인한다.
  it('강도는 기본 강도보다 세지지 않고, 상한·고정 규칙을 항상 지킨다', { timeout: 30000 }, () => {
    const rank = (i: Intensity) => ['rest', 'light', 'moderate', 'high'].indexOf(i);
    const violations: string[] = [];
    let count = 0;
    for (const sleepBand of ratings) {
      for (const sleepQuality of ratings) {
        for (const fatigue of ratings) {
          for (const mood of ratings) {
            for (const yesterdayLoad of ratings) {
              for (const soreness of sorenessSamples) {
                const input: CheckinInput = { sleepBand, sleepQuality, fatigue, soreness, mood, yesterdayLoad };
                const r = decideIntensity(input);
                const label = JSON.stringify(input);
                const maxPoint = Math.max(...SORENESS_PARTS.map((p) => soreness[p]));

                // 규칙은 강도를 낮출 뿐 올리지 않는다
                if (rank(r.intensity) > rank(r.baseIntensity)) violations.push(`강도가 올라감: ${label}`);
                // 6부위가 모두 4점 이상이면 항상 휴식
                if (r.restLocked && r.intensity !== 'rest') violations.push(`휴식 고정 어김: ${label}`);
                // 수면 5시간 미만이거나 근육통 5점이면 "보통"을 넘지 않는다
                if ((sleepBand === 1 || maxPoint >= 5) && rank(r.intensity) > rank('moderate')) {
                  violations.push(`상한 어김: ${label}`);
                }
                // 쉬어야 할 부위는 모두 4점 이상
                for (const part of r.restParts) {
                  if (soreness[part] < 4) violations.push(`쉬어야 할 부위 오류(${part}): ${label}`);
                }
                // 점수 40 미만일 때만 휴식 권장
                if (r.restRecommended !== r.score < 40) violations.push(`휴식 권장 오류: ${label}`);
                count += 1;
              }
            }
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
    expect(count).toBe(5 * 5 * 5 * 5 * 5 * sorenessSamples.length);
  });
});
