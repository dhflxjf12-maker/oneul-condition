import { INTENSITY_LABELS, REST_RECOMMENDED_BELOW_SCORE, SORENESS_PART_LABELS } from "@/lib/domain/constants";
import type { IntensityResult } from "@/lib/domain/intensity";
import { Card } from "./Card";

// Design Ref: §5.2 결과 화면 — 큰 점수 숫자(72px 이상)와 강도 이름을 가장 먼저 보여 준다.
// 점수 40 미만이면 "휴식 권장"을 글자로 함께 보여 준다(색에만 의존하지 않음).

type ScoreCardProps = {
  result: IntensityResult;
};

/** 큰 점수 + 강도 이름 카드 */
export function ScoreCard({ result }: ScoreCardProps) {
  const { score, intensity, restRecommended, restLocked, cappedByRule, restParts } = result;

  return (
    <Card aria-labelledby="score-heading" className="text-center">
      <h2 id="score-heading" className="text-lg font-bold">
        오늘의 컨디션
      </h2>

      <p className="mt-2 leading-none">
        <span className="text-[5rem] font-bold tabular-nums">{score}</span>
        <span className="ml-1 text-2xl font-bold">점</span>
      </p>
      <p className="mt-3 text-2xl font-bold">
        <span aria-hidden="true">· </span>
        {INTENSITY_LABELS[intensity]}
        <span aria-hidden="true"> ·</span>
        <span className="sr-only"> 운동 강도</span>
      </p>

      {restRecommended ? (
        <p className="mt-4 rounded-control border-2 border-danger px-3 py-2 font-bold text-danger">
          <span aria-hidden="true">⚠ </span>
          휴식 권장 · 점수가 {REST_RECOMMENDED_BELOW_SCORE}점 미만이에요
        </p>
      ) : null}

      {restLocked ? (
        <p className="mt-4 rounded-control border-2 border-danger px-3 py-2 font-bold text-danger">
          <span aria-hidden="true">⚠ </span>
          여섯 부위 근육통이 모두 높아 오늘은 휴식으로 정했어요
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-1 text-ink-sub">
        {cappedByRule ? <li>수면이나 근육통 때문에 강도를 &quot;보통&quot;까지로 낮췄어요.</li> : null}
        {restParts.length > 0 && !restLocked ? (
          <li>쉬어야 할 부위: {restParts.map((part) => SORENESS_PART_LABELS[part]).join("·")}</li>
        ) : null}
      </ul>
    </Card>
  );
}
