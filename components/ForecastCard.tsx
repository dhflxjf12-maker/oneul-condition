import { TREND_MIN_RECORDS, TREND_WINDOW_DAYS } from "@/lib/domain/constants";
import type { TrendResult } from "@/lib/domain/trend";
import type { TrendLabel } from "@/lib/domain/types";
import { Card } from "./Card";

// Design Ref: §5.2·PRD ③ — 내일 컨디션 경향. 세 가지 표현("올라갈 가능성/비슷/내려갈 가능성")만 쓰고 정확한 점수는 말하지 않는다.
// 최근 14일 중 기록이 7일 미만이면 예상 대신 "기록을 모으는 중"을 보여 준다. 항상 "참고용 경향 안내"라고 표시한다.

const LABELS: Record<TrendLabel, { text: string; mark: string }> = {
  up: { text: "올라갈 가능성", mark: "↑" },
  similar: { text: "비슷", mark: "→" },
  down: { text: "내려갈 가능성", mark: "↓" },
};

type ForecastCardProps = { trend: TrendResult };

/** 내일 컨디션 예상 카드 */
export function ForecastCard({ trend }: ForecastCardProps) {
  return (
    <Card aria-labelledby="forecast-heading">
      <h2 id="forecast-heading" className="text-lg font-bold">
        내일 컨디션
      </h2>

      {trend.status === "ready" ? (
        <p className="mt-2 text-2xl font-bold">
          <span aria-hidden="true">{LABELS[trend.label].mark} </span>
          {LABELS[trend.label].text}
        </p>
      ) : (
        <>
          <p className="mt-2 text-lg font-semibold">기록을 모으는 중</p>
          <p className="mt-1 text-ink-sub">
            최근 {TREND_WINDOW_DAYS}일 중 {TREND_MIN_RECORDS}일 이상 기록이 쌓이면 보여 드려요. (지금 {trend.recordCount}일)
          </p>
        </>
      )}

      <p className="mt-3 text-ink-sub">참고용 경향 안내예요. 실제 컨디션과 다를 수 있어요.</p>
    </Card>
  );
}
