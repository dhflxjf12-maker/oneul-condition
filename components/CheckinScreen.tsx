"use client";

import { useState } from "react";
import { INTENSITY_LABELS, LEVEL_LABELS, SORENESS_PART_LABELS } from "@/lib/domain/constants";
import { decideIntensity } from "@/lib/domain/intensity";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckinForm, type CheckinResult } from "./CheckinForm";

// Design Ref: §5.1 — "/" 한 화면 안에서 체크인 → 결과로 단계가 바뀐다.
// 이 파일의 결과 부분은 작업 8번(점수 화면)이 오기 전까지 쓰는 임시 표시다.

/** 체크인 화면. 입력을 마치면 (임시) 결과를 보여 주고, 입력 폼은 값을 잃지 않게 화면에서만 숨긴다. */
export function CheckinScreen() {
  const [result, setResult] = useState<CheckinResult | null>(null);

  function handleComplete(next: CheckinResult) {
    setResult(next);
    window.scrollTo({ top: 0 });
  }

  const decided = result ? decideIntensity(result.input) : null;

  return (
    <>
      <div hidden={result !== null}>
        <CheckinForm onComplete={handleComplete} />
      </div>

      {result && decided ? (
        <>
          <Card aria-labelledby="temp-result">
            <h2 id="temp-result" className="text-lg font-bold">
              입력을 마쳤어요 (임시 결과)
            </h2>
            <p className="mt-2 text-2xl font-bold">
              {decided.score}점 · {INTENSITY_LABELS[decided.intensity]}
            </p>
            <ul className="mt-3 flex flex-col gap-1 text-ink-sub">
              <li>운동 수준: {LEVEL_LABELS[result.level]}</li>
              <li>
                쉬어야 할 부위:{" "}
                {decided.restParts.length > 0
                  ? decided.restParts.map((part) => SORENESS_PART_LABELS[part]).join("·")
                  : "없음"}
              </li>
              {decided.restRecommended ? <li>점수가 40 미만이라 휴식을 권해요.</li> : null}
              {decided.restLocked ? <li>근육통 6부위가 모두 4점 이상이라 휴식으로 정했어요.</li> : null}
              {decided.cappedByRule ? <li>수면·근육통 때문에 강도를 &quot;보통&quot;까지로 낮췄어요.</li> : null}
            </ul>
            <p className="mt-3 text-ink-sub">점수 화면과 운동 제안은 다음 작업(8~10번)에서 제대로 만들어져요.</p>
          </Card>
          <Card>
            <Button variant="secondary" className="w-full" onClick={() => setResult(null)}>
              입력 고치기
            </Button>
          </Card>
        </>
      ) : null}
    </>
  );
}
