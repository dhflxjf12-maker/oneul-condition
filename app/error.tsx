"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";

// Design Ref: §6 오류 처리 — 예상 못한 서버 오류가 나도 빈 화면이나 개발자용 오류 대신 "잠시 후 다시 시도해 주세요"를 보여 준다.
// 오류 내용(스택·메시지)은 사용자에게 보여 주지 않는다.

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <Card as="div">
        <h1 className="text-xl font-bold">
          <span aria-hidden="true">⚠ </span>
          문제가 생겼어요
        </h1>
        <p className="mt-2 text-ink-sub">잠시 후 다시 시도해 주세요. 계속되면 관리자에게 알려 주세요.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => reset()}>다시 시도</Button>
          <Link href="/" className={buttonClassName("secondary")}>
            첫 화면으로
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}
