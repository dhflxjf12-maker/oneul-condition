import { INTENSITY_LABELS } from "@/lib/domain/constants";
import type { Intensity } from "@/lib/domain/types";
import { Card } from "./Card";

// Design Ref: §5.2 기록·추이 화면 — 최근 7일 점수를 막대와 숫자 글자로 함께 보여 준다. (막대 모양만으로 알 수 없게 숫자를 병기)

export type WeekPoint = { date: string; score: number | null; intensity: Intensity | null };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-11-24" → "11/24(화)" */
function formatDay(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}(${WEEKDAYS[date.getUTCDay()]})`;
}

const CHART_HEIGHT_PX = 120;

type TrendChartProps = { points: WeekPoint[]; today: string };

/** 최근 7일 점수 막대 그래프 */
export function TrendChart({ points, today }: TrendChartProps) {
  const recorded = points.filter((point) => point.score !== null).length;

  return (
    <Card aria-labelledby="trend-heading">
      <h2 id="trend-heading" className="text-lg font-bold">
        최근 7일 점수
      </h2>

      {recorded === 0 ? (
        <p className="mt-2 text-ink-sub">아직 기록이 없어요. 체크인을 하면 여기에 점수가 쌓여요.</p>
      ) : (
        <>
          {/* 막대 그래프: 화면 읽기 프로그램은 아래 목록을 읽으므로 그래프 자체는 숨긴다 */}
          <div aria-hidden="true" className="mt-4 flex items-end gap-2" style={{ height: CHART_HEIGHT_PX + 28 }}>
            {points.map((point) => (
              <div key={point.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-base font-bold tabular-nums">{point.score ?? "–"}</span>
                <div
                  className={`w-full rounded-t-control ${point.score === null ? "border-2 border-dashed border-control-line" : "bg-accent"}`}
                  style={{ height: point.score === null ? 6 : Math.max(6, Math.round((point.score / 100) * CHART_HEIGHT_PX)) }}
                />
              </div>
            ))}
          </div>
          <div aria-hidden="true" className="mt-1 flex gap-2 text-center text-xs text-ink-sub">
            {points.map((point) => (
              <span key={point.date} className={`flex-1 ${point.date === today ? "font-bold text-ink" : ""}`}>
                {formatDay(point.date).replace("(", "\n(")}
              </span>
            ))}
          </div>

          {/* 글자로 읽는 같은 정보 */}
          <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3">
            {[...points].reverse().map((point) => (
              <li key={point.date} className="flex justify-between gap-3">
                <span className={point.date === today ? "font-bold" : ""}>
                  {formatDay(point.date)}
                  {point.date === today ? " 오늘" : ""}
                </span>
                <span className="text-ink-sub">
                  {point.score === null ? "기록 없음" : `${point.score}점 · ${INTENSITY_LABELS[point.intensity ?? "moderate"]}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
