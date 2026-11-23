"use client";

import { useState } from "react";
import { LEVEL_LABELS } from "@/lib/domain/constants";
import { decideIntensity } from "@/lib/domain/intensity";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckinForm, type CheckinResult } from "./CheckinForm";
import { SafetyNotice } from "./SafetyNotice";
import { ScoreCard } from "./ScoreCard";

// Design Ref: §5.1 — "/" 한 화면 안에서 체크인 → 결과로 단계가 바뀐다.
// 결과 화면: 점수 카드 → (제안 카드: 작업 9~10번) → 안전 안내문 → 입력 고치기.

/** 체크인 화면. 입력을 마치면 결과를 보여 주고, 입력 폼은 값을 잃지 않게 화면에서만 숨긴다. */
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
          <ScoreCard result={decided} />

          <Card aria-labelledby="suggestion-heading">
            <h2 id="suggestion-heading" className="text-lg font-bold">
              오늘의 제안
            </h2>
            <p className="mt-2 text-ink-sub">
              운동 수준: {LEVEL_LABELS[result.level]}. 구체적인 운동 제안은 다음 작업(9~10번)에서 만들어져요.
            </p>
          </Card>

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
