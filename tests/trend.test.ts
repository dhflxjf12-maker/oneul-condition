import { describe, expect, it } from 'vitest';
import { TREND_DIFF_THRESHOLD } from '../lib/domain/constants';
import {
  addDaysToDateKey,
  buildWeekSeries,
  calculateTrend,
  recordsInWindow,
  trendDifference,
  type DayScore,
} from '../lib/domain/trend';

const TODAY = '2026-11-24';
const day = (offset: number) => addDaysToDateKey(TODAY, offset);
/** 오늘부터 거꾸로 하루씩 점수를 채운다. scores[0]이 오늘. */
const seq = (scores: number[]): DayScore[] => scores.map((score, i) => ({ date: day(-i), score }));

describe('날짜 계산', () => {
  it('달·연도 경계를 넘어 계산한다', () => {
    expect(addDaysToDateKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysToDateKey('2028-03-01', -1)).toBe('2028-02-29'); // 윤년
  });
});

describe('기록 모으기(14일 창)', () => {
  it('오늘 포함 14일(오늘-13일 ~ 오늘)만 세고 최신순으로 정렬한다', () => {
    const records: DayScore[] = [
      { date: day(-13), score: 10 }, // 포함 (14번째 날)
      { date: day(-14), score: 99 }, // 제외
      { date: day(1), score: 99 }, // 미래: 제외
      { date: day(-2), score: 20 },
      { date: day(0), score: 30 },
    ];
    expect(recordsInWindow(records, TODAY).map((r) => r.score)).toEqual([30, 20, 10]);
  });

  it('같은 날짜가 겹치면 하루로 센다', () => {
    expect(recordsInWindow([...seq([50]), { date: TODAY, score: 60 }], TODAY)).toHaveLength(1);
  });
});

describe('기록이 7일 미만이면 예상을 내지 않는다', () => {
  it('6일은 "모으는 중", 7일은 예상', () => {
    expect(calculateTrend(seq([50, 50, 50, 50, 50, 50]), TODAY)).toEqual({ status: 'collecting', recordCount: 6 });
    expect(calculateTrend(seq([50, 50, 50, 50, 50, 50, 50]), TODAY).status).toBe('ready');
    expect(calculateTrend([], TODAY)).toEqual({ status: 'collecting', recordCount: 0 });
  });

  it('연속이 아니어도 14일 안에 7개면 예상한다', () => {
    const scattered = [0, -2, -4, -6, -8, -10, -12].map((o, i) => ({ date: day(o), score: 50 + i }));
    expect(calculateTrend(scattered, TODAY).status).toBe('ready');
  });

  it('14일 밖(오래된) 기록만 있으면 세지 않는다', () => {
    const old = [-14, -15, -16, -17, -18, -19, -20].map((o) => ({ date: day(o), score: 50 }));
    expect(calculateTrend(old, TODAY)).toEqual({ status: 'collecting', recordCount: 0 });
  });

  it('14일 중 6개 + 14일 밖 기록은 여전히 모으는 중', () => {
    const records = [...seq([50, 50, 50, 50, 50, 50]), { date: day(-20), score: 50 }];
    expect(calculateTrend(records, TODAY).status).toBe('collecting');
  });
});

describe('기복 예상 계산 (정수, 경계값)', () => {
  it('차이 = 최근 3개 합 × 7 − 최근 7개 합 × 3', () => {
    // 최근 3개 합 = 240, 7개 합 = 240 + 4×50 = 440 → 240×7 − 440×3 = 1680 − 1320 = 360
    expect(trendDifference(seq([80, 80, 80, 50, 50, 50, 50]))).toBe(360);
    expect(trendDifference(seq([50, 50, 50, 50, 50, 50]))).toBeNull();
  });

  it('모두 같으면 차이 0 → 비슷', () => {
    expect(trendDifference(seq(Array(7).fill(60)))).toBe(0);
    expect(calculateTrend(seq(Array(7).fill(60)), TODAY)).toMatchObject({ status: 'ready', label: 'similar' });
  });

  // 차이 = 7×s − 3×(s+r) = 4s − 3r  (s = 최근 3개 합, r = 그 다음 4개 합)
  it('차이가 정확히 +105면 올라갈 가능성, +104면 비슷', () => {
    const exact = seq([59, 59, 59, 50, 50, 50, 51]); // s=177, r=201 → 708 − 603
    expect(trendDifference(exact)).toBe(TREND_DIFF_THRESHOLD);
    expect(calculateTrend(exact, TODAY)).toMatchObject({ label: 'up' });
    const justBelow = seq([59, 59, 58, 50, 50, 50, 50]); // s=176, r=200 → 704 − 600
    expect(trendDifference(justBelow)).toBe(104);
    expect(calculateTrend(justBelow, TODAY)).toMatchObject({ label: 'similar' });
  });

  it('차이가 정확히 −105면 내려갈 가능성, −104면 비슷', () => {
    const exact = seq([42, 42, 42, 50, 51, 51, 51]); // s=126, r=203 → 504 − 609
    expect(trendDifference(exact)).toBe(-TREND_DIFF_THRESHOLD);
    expect(calculateTrend(exact, TODAY)).toMatchObject({ label: 'down' });
    const justInside = seq([41, 41, 42, 50, 50, 50, 50]); // s=124, r=200 → 496 − 600
    expect(trendDifference(justInside)).toBe(-104);
    expect(calculateTrend(justInside, TODAY)).toMatchObject({ label: 'similar' });
  });

  it('최근 7개만 쓴다 (8번째 이후 기록은 영향이 없다)', () => {
    const base = seq([60, 60, 60, 60, 60, 60, 60]);
    const withOld = [...base, { date: day(-7), score: 0 }, { date: day(-8), score: 100 }];
    expect(trendDifference(recordsInWindow(withOld, TODAY))).toBe(trendDifference(base));
  });

  it('입력 순서가 달라도 같은 결과', () => {
    const records = seq([80, 70, 60, 50, 40, 30, 20]);
    expect(calculateTrend([...records].reverse(), TODAY)).toEqual(calculateTrend(records, TODAY));
  });

  it('점수가 크게 오르면 up, 크게 떨어지면 down', () => {
    expect(calculateTrend(seq([90, 90, 90, 40, 40, 40, 40]), TODAY)).toMatchObject({ label: 'up' });
    expect(calculateTrend(seq([20, 20, 20, 70, 70, 70, 70]), TODAY)).toMatchObject({ label: 'down' });
  });
});

describe('최근 7일 표', () => {
  it('오늘 포함 7일을 오래된 날부터, 기록 없는 날은 null로 만든다', () => {
    const series = buildWeekSeries([{ date: day(0), score: 70 }, { date: day(-2), score: 55 }, { date: day(-9), score: 10 }], TODAY);
    expect(series.map((s) => s.date)).toEqual([-6, -5, -4, -3, -2, -1, 0].map(day));
    expect(series.map((s) => s.score)).toEqual([null, null, null, null, 55, null, 70]);
  });
});
