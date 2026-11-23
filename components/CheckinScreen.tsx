"use client";

import { useMemo, useState } from "react";
import { decideIntensity } from "@/lib/domain/intensity";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckinForm, type CheckinResult } from "./CheckinForm";
import { SafetyNotice } from "./SafetyNotice";
import { SuggestionCard } from "./SuggestionCard";
import { ScoreCard } from "./ScoreCard";

// Design Ref: §5.1 — "/" 한 화면 안에서 체크인 → 결과로 단계가 바뀐다.
// 결과 화면: 점수 카드 → 제안 카드 → 안전 안내문 → 입력 고치기.

/** 체크인 화면. 입력을 마치면 결과를 보여 주고, 입력 폼은 값을 잃지 않게 화면에서만 숨긴다. */
export function CheckinScreen() {
  const [result, setResult] = useState<CheckinResult | null>(null);

  function handleComplete(next: CheckinResult) {
    setResult(next);
    window.scrollTo({ top: 0 });
  }

  // 같은 결과로는 다시 계산하지 않는다. (제안 카드가 화면이 다시 그려질 때마다 서버를 부르지 않게)
  const decided = useMemo(() => (result ? decideIntensity(result.input) : null), [result]);

  return (
    <>
      <div hidden={result !== null}>
        <CheckinForm onComplete={handleComplete} />
      </div>

      {result && decided ? (
        <>
          <ScoreCard result={decided} />

          <SuggestionCard level={result.level} input={result.input} decided={decided} />

          <SafetyNotice />

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
