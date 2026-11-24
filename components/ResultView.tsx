"use client";

import { useEffect, useRef, useState } from "react";
import { markSuggestionViewed } from "@/app/actions/checkin";
import { SUGGESTION_VIEWED_MS } from "@/lib/domain/constants";
import type { IntensityResult } from "@/lib/domain/intensity";
import type { CheckinInput, ExerciseLevel, Suggestion, SuggestionSource } from "@/lib/domain/types";
import { FeedbackCard } from "./FeedbackCard";
import { RecordSaver } from "./RecordSaver";
import { SafetyNotice } from "./SafetyNotice";
import { ScoreCard } from "./ScoreCard";
import { SuggestionCard } from "./SuggestionCard";
import { SurveyPrompt } from "./SurveyPrompt";

// Design Ref: §5.2 결과 화면 — 점수 카드 → 제안 카드 → 👍/👎(로그인·저장 뒤) → 기록 저장 상태 → 안전 안내문 → (주 1회) 체감 질문.
// 입력을 고쳐 다시 점수를 볼 때마다 새로 만들어져서(부모가 key를 바꿈), 제안·저장도 새로 시작한다.
// 이용 기록(지표 측정용): 제안이 3초 이상 화면에 보이면 markSuggestionViewed로 "표시됨"만 남긴다.

type ResultViewProps = {
  level: ExerciseLevel;
  input: CheckinInput;
  /** 체크인 소요 시간(초), 측정하지 못했으면 없음 */
  durationSeconds?: number;
  decided: IntensityResult;
  loggedIn: boolean | null;
};

/** 결과 화면 (점수·제안·기록 저장·안내) */
export function ResultView({ level, input, durationSeconds, decided, loggedIn }: ResultViewProps) {
  const [resolved, setResolved] = useState<{ source: SuggestionSource; suggestion: Suggestion } | null>(null);
  // 제안까지 저장되면 그 기록의 날짜가 채워진다. 👍/👎는 그때부터 보인다.
  const [savedDate, setSavedDate] = useState<string | null>(null);
  // 제안이 화면에 처음 나타난 시각 (3초 표시 판단의 기준)
  const shownAtRef = useRef<number | null>(null);

  function handleResolved(source: SuggestionSource, suggestion: Suggestion) {
    shownAtRef.current ??= Date.now();
    setResolved({ source, suggestion });
  }

  // 제안이 저장된 기록에 대해, 화면에 3초 이상 보였으면 표시 여부를 남긴다. (화면이 가려져 있는 동안은 세지 않는다)
  useEffect(() => {
    const shownAt = shownAtRef.current;
    if (!savedDate || shownAt === null) return;
    let cancelled = false;

    function fire() {
      if (cancelled) return;
      // 탭이 가려져 있으면 다시 보일 때까지 기다린다.
      if (document.visibilityState === "hidden") {
        document.addEventListener("visibilitychange", fire, { once: true });
        return;
      }
      // 실패해도 사용자에게 알리지 않는다. (지표용 기록일 뿐이라 사용에는 영향이 없다)
      markSuggestionViewed({ checkinDate: savedDate }).catch(() => {});
    }

    const timer = setTimeout(fire, Math.max(0, SUGGESTION_VIEWED_MS - (Date.now() - shownAt)));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", fire);
    };
  }, [savedDate]);

  return (
    <>
      <ScoreCard result={decided} />
      <SuggestionCard level={level} input={input} decided={decided} onResolved={handleResolved} />
      {savedDate ? <FeedbackCard checkinDate={savedDate} /> : null}
      <RecordSaver
        loggedIn={loggedIn}
        level={level}
        input={input}
        durationSeconds={durationSeconds}
        resolved={resolved}
        onSaved={setSavedDate}
        onRetry={() => setSavedDate(null)}
      />
      <SafetyNotice />
      {savedDate ? <SurveyPrompt /> : null}
    </>
  );
}
