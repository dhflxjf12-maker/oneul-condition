"use client";

import { useEffect, useMemo, useState } from "react";
import { getLoginStatus } from "@/app/actions/checkin";
import { decideIntensity } from "@/lib/domain/intensity";
import { Button } from "./Button";
import { Card } from "./Card";
import { CheckinForm, type CheckinResult } from "./CheckinForm";
import { ResultView } from "./ResultView";

// Design Ref: §5.1 — "/" 한 화면 안에서 체크인 → 결과로 단계가 바뀐다.
// 결과 화면: 점수 카드 → 제안 카드 → 기록 저장 상태 → 안전 안내문 → 입력 고치기.

/** 체크인 화면. 입력을 마치면 결과를 보여 주고, 입력 폼은 값을 잃지 않게 화면에서만 숨긴다. */
export function CheckinScreen() {
  // 점수를 낼 때마다 올라가는 번호. 결과 화면을 새로 시작하는 데 쓴다. (같은 날 다시 체크인 → 기록 수정)
  const [submission, setSubmission] = useState<{ id: number; result: CheckinResult } | null>(null);
  // 로그인 여부 (확인 전에는 null). 비로그인이면 체크인 값을 서버로 보내지 않는다.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLoginStatus()
      .then((status) => {
        if (!cancelled) setLoggedIn(status);
      })
      .catch(() => {
        // 확인하지 못하면 로그인하지 않은 것으로 보고 아무것도 저장하지 않는다.
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 결과가 나타나면 키보드·화면 읽기 사용자가 바로 알 수 있도록 점수 제목으로 초점을 옮긴다. (버튼이 사라지며 초점을 잃는 것을 막음)
  const submissionId = submission?.id;
  useEffect(() => {
    if (submissionId === undefined) return;
    document.getElementById("score-heading")?.focus({ preventScroll: true });
  }, [submissionId]);

  function handleComplete(result: CheckinResult) {
    setSubmission((previous) => ({ id: (previous?.id ?? 0) + 1, result }));
    window.scrollTo({ top: 0 });
  }

  const result = submission?.result ?? null;
  // 같은 결과로는 다시 계산하지 않는다. (제안 카드가 화면이 다시 그려질 때마다 서버를 부르지 않게)
  const decided = useMemo(() => (result ? decideIntensity(result.input) : null), [result]);

  return (
    <>
      <div hidden={submission !== null}>
        <CheckinForm onComplete={handleComplete} />
      </div>

      {submission && result && decided ? (
        <>
          <ResultView
            key={submission.id}
            level={result.level}
            input={result.input}
            durationSeconds={result.durationSeconds}
            decided={decided}
            loggedIn={loggedIn}
          />
          <Card>
            <Button variant="secondary" className="w-full" onClick={() => setSubmission(null)}>
              입력 고치기
            </Button>
          </Card>
        </>
      ) : null}
    </>
  );
}
