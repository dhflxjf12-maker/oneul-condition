"use client";

import { useEffect, useRef, useState } from "react";
import { getWeeklySurvey, saveSurvey } from "@/app/actions/checkin";
import { Button } from "./Button";
import { Card } from "./Card";

// Design Ref: §5.2 — 로그인한 사용자에게 주 1회, 첫 체크인(저장)을 마친 뒤 "지난주 점수가 체감과 맞았나요?"를 한 번 묻는다.
// 지난주에 기록이 없거나 이번 주에 이미 물었다면 아무것도 보이지 않는다. 응답하지 않아도 이용에는 영향이 없다.

type State =
  | { name: "checking" }
  | { name: "hidden" }
  | { name: "asking"; weekStart: string; failed: boolean }
  | { name: "saving"; weekStart: string }
  | { name: "done" };

/** 주 1회 체감 질문 카드 */
export function SurveyPrompt() {
  const [state, setState] = useState<State>({ name: "checking" });
  // 확인 요청은 한 번만 보낸다. 서버가 "물어봤다"고 기록하므로, 개발 모드에서 효과가 두 번 실행되어도 중복되지 않게 한다.
  const askedRef = useRef(false);

  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    getWeeklySurvey()
      .then((due) => setState(due ? { name: "asking", weekStart: due.weekStart, failed: false } : { name: "hidden" }))
      .catch(() => setState({ name: "hidden" }));
  }, []);

  async function answer(weekStart: string, matched: boolean) {
    setState({ name: "saving", weekStart });
    try {
      const result = await saveSurvey({ weekStart, matched });
      setState(result.ok ? { name: "done" } : { name: "asking", weekStart, failed: true });
    } catch {
      setState({ name: "asking", weekStart, failed: true });
    }
  }

  if (state.name === "checking" || state.name === "hidden") return null;

  if (state.name === "done") {
    return (
      <Card aria-labelledby="survey-heading">
        <h2 id="survey-heading" className="text-base font-bold">
          지난주 점수와 체감
        </h2>
        <p role="status" className="mt-1 text-ink-sub">
          <span aria-hidden="true">✓ </span>답해 주셔서 고마워요.
        </p>
      </Card>
    );
  }

  const busy = state.name === "saving";
  return (
    <Card aria-labelledby="survey-heading">
      <h2 id="survey-heading" className="text-base font-bold">
        지난주 점수가 체감과 맞았나요?
      </h2>
      <p className="mt-1 text-ink-sub">일주일에 한 번만 여쭤요. 답하지 않고 넘어가도 괜찮아요.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => answer(state.weekStart, true)}>
          맞았다
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => answer(state.weekStart, false)}>
          아니다
        </Button>
      </div>
      {busy ? (
        <p role="status" className="mt-3 text-ink-sub">
          저장하는 중…
        </p>
      ) : null}
      {state.name === "asking" && state.failed ? (
        <p role="alert" className="mt-3 font-semibold text-danger">
          <span aria-hidden="true">⚠ </span>
          저장하지 못했어요. 다시 눌러 주세요.
        </p>
      ) : null}
    </Card>
  );
}
