"use client";

import { useEffect, useState } from "react";
import {
  EXERCISE_TYPE_LABELS,
  SORENESS_PART_LABELS,
  SUGGESTION_UI_TIMEOUT_MS,
} from "@/lib/domain/constants";
import { getFallbackSuggestion } from "@/lib/domain/fallback";
import type { IntensityResult } from "@/lib/domain/intensity";
import type { CheckinInput, ExerciseLevel, Suggestion, SuggestionSource } from "@/lib/domain/types";
import { Card } from "./Card";

// Design Ref: §5.2 — 오늘의 제안 카드: 운동 종류·시간·쉬어야 할 부위, 제안이 오기 전에는 "불러오는 중"(최대 5초).
// Plan SC: AI가 느리거나 실패해도 5초 안에 기본 문구가 나온다. (작업 10번)

type SuggestionCardProps = {
  level: ExerciseLevel;
  input: CheckinInput;
  /** 점수·강도 계산 결과 (이 강도는 제안이 바꾸지 못한다) */
  decided: IntensityResult;
};

type State = { status: "loading" } | { status: "done"; source: SuggestionSource; suggestion: Suggestion };

/** 부위 이름 목록 ("어깨·등", 전신이면 "전신") */
function partNames(parts: readonly (keyof typeof SORENESS_PART_LABELS | "whole")[]): string {
  return parts.map((part) => (part === "whole" ? "전신" : SORENESS_PART_LABELS[part])).join("·");
}

/** 운동 제안 카드. 점수 확인 직후 /api/suggestion을 부르고, 5초가 지나거나 실패하면 기본 문구로 바꾼다. */
export function SuggestionCard({ level, input, decided }: SuggestionCardProps) {
  // 근육통 6부위가 모두 높아 휴식으로 고정이면 서버를 부르지 않고 바로 기본 안내를 보여 준다.
  const [state, setState] = useState<State>(() =>
    decided.restLocked
      ? { status: "done", source: "fallback", suggestion: getFallbackSuggestion(level, decided.intensity, decided.restParts) }
      : { status: "loading" },
  );

  useEffect(() => {
    if (decided.restLocked) return;

    const controller = new AbortController();
    let finished = false;

    // 한 번만 결과를 정한다. 5초 타이머와 응답 중 먼저 도착한 쪽이 이긴다.
    function finish(source: SuggestionSource, suggestion: Suggestion) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      setState({ status: "done", source, suggestion });
    }
    function applyFallback() {
      finish("fallback", getFallbackSuggestion(level, decided.intensity, decided.restParts));
    }

    const timer = setTimeout(() => {
      controller.abort();
      applyFallback();
    }, SUGGESTION_UI_TIMEOUT_MS);

    fetch("/api/suggestion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, checkin: input }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("서버 오류"))))
      .then((data: { source?: SuggestionSource; suggestion?: Suggestion }) => {
        if (data.suggestion && (data.source === "ai" || data.source === "fallback")) {
          finish(data.source, data.suggestion);
        } else {
          applyFallback();
        }
      })
      .catch(() => applyFallback());

    return () => {
      finished = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [level, input, decided]);

  return (
    <Card aria-labelledby="suggestion-heading" aria-busy={state.status === "loading"}>
      <h2 id="suggestion-heading" className="text-lg font-bold">
        오늘의 제안
      </h2>

      {state.status === "loading" ? (
        <p role="status" className="mt-2 text-ink-sub">
          제안을 불러오는 중… (최대 5초)
        </p>
      ) : (
        <div role="status">
          <p className="mt-2 text-2xl font-bold">
            {EXERCISE_TYPE_LABELS[state.suggestion.type]} {state.suggestion.minutes}분
          </p>
          <p className="mt-2">{state.suggestion.message}</p>
          <ul className="mt-3 flex flex-col gap-1 text-ink-sub">
            {state.suggestion.targetParts.length > 0 ? <li>사용 부위: {partNames(state.suggestion.targetParts)}</li> : null}
            <li>
              쉬어야 할 부위:{" "}
              {state.suggestion.restParts.length > 0 ? partNames(state.suggestion.restParts) : "없음"}
            </li>
          </ul>
          <p className="mt-3 text-sm text-ink-sub">{state.source === "ai" ? "AI가 만든 제안" : "기본 안내"}</p>
        </div>
      )}
    </Card>
  );
}
