"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/app/actions/auth";
import { Button } from "./Button";
import { Card } from "./Card";

// Design Ref: §5.2 계정 화면 — [계정 삭제] → "정말 삭제할까요? 되돌릴 수 없어요" 한 번 더 확인 (PRD: 삭제 전에 한 번 더 확인).
// 첫 단계에서는 삭제가 일어나지 않고, 확인 단계의 [삭제하기]를 눌러야만 서버에 요청한다.

/** 계정 삭제 (2단계 확인) */
export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(async () => deleteAccount(), undefined);

  if (!confirming) {
    return (
      <Card aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="text-lg font-bold">
          계정 삭제
        </h2>
        <p className="mt-1 text-ink-sub">계정과 지금까지의 체크인 기록을 모두 지워요.</p>
        <Button variant="secondary" className="mt-3" onClick={() => setConfirming(true)}>
          계정 삭제
        </Button>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="delete-confirm-heading" className="border-2 border-danger">
      <h2 id="delete-confirm-heading" className="text-lg font-bold text-danger">
        <span aria-hidden="true">⚠ </span>
        정말 삭제할까요?
      </h2>
      <p className="mt-2 font-semibold">되돌릴 수 없어요.</p>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-ink-sub">
        <li>계정(이메일·비밀번호)이 삭제돼요.</li>
        <li>체크인 기록, 제안 평가, 체감 응답이 모두 삭제돼요.</li>
        <li>삭제한 뒤에는 같은 이메일로 새로 가입할 수 있지만, 기록은 돌아오지 않아요.</li>
      </ul>
      {state?.message ? (
        <p role="alert" className="mt-3 font-semibold text-danger">
          <span aria-hidden="true">⚠ </span>
          {state.message}
        </p>
      ) : null}
      <form action={formAction} className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)} autoFocus>
          취소
        </Button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control bg-danger px-5 py-2 text-base font-semibold text-white disabled:opacity-60"
        >
          {pending ? "삭제하는 중…" : "삭제하기"}
        </button>
      </form>
    </Card>
  );
}
