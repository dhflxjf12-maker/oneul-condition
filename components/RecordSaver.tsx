"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveCheckin, saveSuggestion } from "@/app/actions/checkin";
import type { CheckinInput, ExerciseLevel, Suggestion, SuggestionSource } from "@/lib/domain/types";
import { Button, buttonClassName } from "./Button";
import { Card } from "./Card";

// Design Ref: §4.4·§5.2 — 로그인한 사용자는 점수 확인 직후 자동으로 기록을 저장한다.
//  1) saveCheckin(점수 확인 직후)  2) saveSuggestion(saveCheckin이 끝난 뒤, 제안이 도착했을 때)
//  저장이 실패해도 점수와 제안은 그대로 보여 주고 "다시 저장" 버튼을 둔다. 다시 저장은 둘 다 다시 보낸다.
//  로그인하지 않았다면 값을 서버로 보내지 않고 안내만 보여 준다.

type Resolved = { source: SuggestionSource; suggestion: Suggestion };

type Phase =
  | { name: "saving" }
  | { name: "checkin-saved"; checkinDate: string }
  | { name: "saved" }
  | { name: "failed" };

type RecordSaverProps = {
  /** 로그인 여부 (아직 모르면 null) */
  loggedIn: boolean | null;
  level: ExerciseLevel;
  input: CheckinInput;
  /** 제안이 정해지면 채워진다 (아직이면 null) */
  resolved: Resolved | null;
};

/** 기록 저장 상태 카드 */
export function RecordSaver({ loggedIn, level, input, resolved }: RecordSaverProps) {
  const [phase, setPhase] = useState<Phase>({ name: "saving" });
  // 다시 저장을 누를 때마다 올라가서, 아래 저장 순서를 처음부터 다시 돌린다.
  const [attempt, setAttempt] = useState(0);

  // 1단계: 체크인 저장
  useEffect(() => {
    if (loggedIn !== true) return;
    let cancelled = false;
    saveCheckin({ level, checkin: input })
      .then((result) => {
        if (cancelled) return;
        setPhase(result.ok ? { name: "checkin-saved", checkinDate: result.checkinDate } : { name: "failed" });
      })
      .catch(() => {
        if (!cancelled) setPhase({ name: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, level, input, attempt]);

  // 2단계: 체크인 저장이 끝났고 제안이 도착했으면 제안 저장
  useEffect(() => {
    if (phase.name !== "checkin-saved" || !resolved) return;
    let cancelled = false;
    saveSuggestion({ checkinDate: phase.checkinDate, source: resolved.source, suggestion: resolved.suggestion })
      .then((result) => {
        if (!cancelled) setPhase(result.ok ? { name: "saved" } : { name: "failed" });
      })
      .catch(() => {
        if (!cancelled) setPhase({ name: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [phase, resolved]);

  function retry() {
    setPhase({ name: "saving" });
    setAttempt((count) => count + 1);
  }

  if (loggedIn === null) return null;

  if (loggedIn === false) {
    return (
      <Card aria-labelledby="record-heading">
        <h2 id="record-heading" className="text-base font-bold">
          기록 저장
        </h2>
        <p className="mt-1 text-ink-sub">로그인한 뒤 오늘 체크인을 다시 하면 기록이 저장돼요.</p>
        <Link href="/login" className={buttonClassName("secondary", "mt-3")}>
          로그인
        </Link>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="record-heading">
      <h2 id="record-heading" className="text-base font-bold">
        기록 저장
      </h2>
      {phase.name === "failed" ? (
        <>
          <p role="alert" className="mt-1 font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            기록 저장에 실패했어요. 점수와 제안은 그대로 볼 수 있어요.
          </p>
          <Button variant="secondary" className="mt-3" onClick={retry}>
            다시 저장
          </Button>
        </>
      ) : (
        <p role="status" className="mt-1 text-ink-sub">
          {phase.name === "saved" ? (
            <>
              <span aria-hidden="true">✓ </span>오늘 기록이 저장됐어요.
            </>
          ) : (
            "기록을 저장하는 중…"
          )}
        </p>
      )}
    </Card>
  );
}
