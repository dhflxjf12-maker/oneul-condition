// 최근 점수 추이와 기복 예상을 계산하는 순수 함수. (정수로만 계산 — 소수 오차 없음)
// Design Ref: PRD ③ 기복 예상 — 오늘을 포함한 최근 14일 중 기록이 7일 이상일 때만 예상을 보여 준다.
// 가장 최근 기록 3개의 합 × 7 − 최근 기록 7개의 합 × 3 이 +105 이상이면 "올라갈 가능성", −105 이하이면 "내려갈 가능성", 그 사이면 "비슷".
// Plan SC: 같은 기록이면 항상 같은 결과가 나오고, 7일 미만이면 예상을 내지 않는다. (작업 19번)
import {
  TREND_BASE_COUNT,
  TREND_DIFF_THRESHOLD,
  TREND_MIN_RECORDS,
  TREND_RECENT_COUNT,
  TREND_WINDOW_DAYS,
} from './constants';
import type { TrendLabel } from './types';

/** 하루 기록 (날짜는 한국 시간 기준 "YYYY-MM-DD") */
export interface DayScore {
  date: string;
  score: number;
}

/** 날짜 문자열에 일수를 더한다. (달력 계산이라 시간대와 무관) */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 오늘을 포함한 최근 14일 안의 기록만, 최신 날짜부터 정렬해서 돌려준다. (같은 날짜 중복은 첫 번째만) */
export function recordsInWindow(records: readonly DayScore[], today: string): DayScore[] {
  const oldest = addDaysToDateKey(today, -(TREND_WINDOW_DAYS - 1));
  const seen = new Set<string>();
  return records
    .filter((record) => record.date >= oldest && record.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .filter((record) => (seen.has(record.date) ? false : (seen.add(record.date), true)));
}

export type TrendResult =
  /** 최근 14일 중 기록이 부족해서 예상을 내지 않음 ("기록을 모으는 중") */
  | { status: 'collecting'; recordCount: number }
  | { status: 'ready'; recordCount: number; label: TrendLabel };

/** 합계 차이 = (최근 3개 합 × 7) − (최근 7개 합 × 3). 기록이 7개 미만이면 null. */
export function trendDifference(recentFirst: readonly DayScore[]): number | null {
  if (recentFirst.length < TREND_BASE_COUNT) return null;
  const sum = (items: readonly DayScore[]) => items.reduce((total, item) => total + item.score, 0);
  const recent = sum(recentFirst.slice(0, TREND_RECENT_COUNT));
  const base = sum(recentFirst.slice(0, TREND_BASE_COUNT));
  return recent * TREND_BASE_COUNT - base * TREND_RECENT_COUNT;
}

/** 기복 예상. 기록이 부족하면 예상 없이 "모으는 중"만 돌려준다. */
export function calculateTrend(records: readonly DayScore[], today: string): TrendResult {
  const windowed = recordsInWindow(records, today);
  if (windowed.length < TREND_MIN_RECORDS) return { status: 'collecting', recordCount: windowed.length };

  const diff = trendDifference(windowed);
  // 위에서 7개 이상임을 확인했으므로 null이 아니다.
  const value = diff ?? 0;
  const label: TrendLabel =
    value >= TREND_DIFF_THRESHOLD ? 'up' : value <= -TREND_DIFF_THRESHOLD ? 'down' : 'similar';
  return { status: 'ready', recordCount: windowed.length, label };
}

/** 최근 7일(오늘 포함) 점수. 기록이 없는 날은 score가 null. 오래된 날짜부터 순서대로. */
export function buildWeekSeries(records: readonly DayScore[], today: string): { date: string; score: number | null }[] {
  const byDate = new Map(records.map((record) => [record.date, record.score]));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDaysToDateKey(today, i - 6);
    return { date, score: byDate.get(date) ?? null };
  });
}
