"use client";

import { useState } from "react";
import type { IntensityResult } from "@/lib/domain/intensity";
import type { CheckinInput, ExerciseLevel, Suggestion, SuggestionSource } from "@/lib/domain/types";
import { RecordSaver } from "./RecordSaver";
import { SafetyNotice } from "./SafetyNotice";
import { ScoreCard } from "./ScoreCard";
import { SuggestionCard } from "./SuggestionCard";

// Design Ref: §5.2 결과 화면 — 점수 카드 → 제안 카드 → 기록 저장 상태 → 안전 안내문.
// 입력을 고쳐 다시 점수를 볼 때마다 새로 만들어져서(부모가 key를 바꿈), 제안·저장도 새로 시작한다.

type ResultViewProps = {
  level: ExerciseLevel;
  input: CheckinInput;
  decided: IntensityResult;
  loggedIn: boolean | null;
};

/** 결과 화면 (점수·제안·기록 저장·안내) */
export function ResultView({ level, input, decided, loggedIn }: ResultViewProps) {
  const [resolved, setResolved] = useState<{ source: SuggestionSource; suggestion: Suggestion } | null>(null);

  return (
    <>
      <ScoreCard result={decided} />
      <SuggestionCard
        level={level}
        input={input}
        decided={decided}
        onResolved={(source, suggestion) => setResolved({ source, suggestion })}
      />
      <RecordSaver loggedIn={loggedIn} level={level} input={input} resolved={resolved} />
      <SafetyNotice />
    </>
  );
}
