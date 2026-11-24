"use client";

import { useState } from "react";
import { saveFeedback } from "@/app/actions/checkin";
import { Card } from "./Card";

// Design Ref: §5.2 — 로그인한 사용자가 오늘의 제안을 👍/👎로 평가한다. (PRD 제안 만족도 지표)
// 선택된 쪽은 색뿐 아니라 ✓ 표시와 aria-pressed로도 알린다. 다시 누르면 바꿔 저장한다.

type Value = "up" | "down";
type Status = "idle" | "saving" | "saved" | "failed";

const OPTIONS: { value: Value; emoji: string; label: string }[] = [
  { value: "up", emoji: "👍", label: "도움이 됐어요" },
  { value: "down", emoji: "👎", label: "아쉬워요" },
];

type FeedbackCardProps = {
  /** 평가를 붙일 기록의 날짜 (제안까지 저장된 기록) */
  checkinDate: string;
};

/** 제안 평가 카드 */
export function FeedbackCard({ checkinDate }: FeedbackCardProps) {
  const [selected, setSelected] = useState<Value | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function choose(value: Value) {
    const previous = selected;
    setSelected(value);
    setStatus("saving");
    try {
      const result = await saveFeedback({ checkinDate, feedback: value });
      if (result.ok) {
        setStatus("saved");
      } else {
        setSelected(previous);
        setStatus("failed");
      }
    } catch {
      setSelected(previous);
      setStatus("failed");
    }
  }

  return (
    <Card aria-labelledby="feedback-heading">
      <h2 id="feedback-heading" className="text-base font-bold">
        오늘의 제안이 도움이 됐나요?
      </h2>
      <div role="group" aria-labelledby="feedback-heading" className="mt-3 flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              disabled={status === "saving"}
              onClick={() => choose(option.value)}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border-2 px-4 py-2 text-base font-semibold transition-colors ${
                active ? "border-accent bg-accent text-white" : "border-control-line bg-card text-ink hover:bg-card-tint"
              }`}
            >
              {active ? (
                <span aria-hidden="true" className="mr-1">
                  ✓
                </span>
              ) : null}
              <span aria-hidden="true" className="mr-1">
                {option.emoji}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-3 min-h-6 text-ink-sub">
        {status === "saving" ? "저장하는 중…" : null}
        {status === "saved" ? "평가가 저장됐어요. 고맙습니다!" : null}
      </p>
      {status === "failed" ? (
        <p role="alert" className="font-semibold text-danger">
          <span aria-hidden="true">⚠ </span>
          평가를 저장하지 못했어요. 다시 눌러 주세요.
        </p>
      ) : null}
    </Card>
  );
}
