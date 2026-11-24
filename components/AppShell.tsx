import type { ReactNode } from "react";
import { Card } from "./Card";

// Design Ref: §5.2·§5.4 — 골드 배경 + 흰색 카드 틀과 머리글(앱 이름, 오른쪽 동작 자리).
// Plan SC: 휴대폰 세로 화면 기준 반응형, 키보드·화면 읽기 사용자를 위한 접근성 기준. (작업 5번)
type AppShellProps = {
  children: ReactNode;
  /** 머리글 오른쪽에 둘 동작(예: 로그인/계정, [기록 보기]). 없으면 비워 둔다. */
  headerAction?: ReactNode;
};

/** 모든 화면의 바깥 틀. 본문은 가운데 정렬된 좁은 칸(최대 36rem)에 세로로 쌓는다. */
export function AppShell({ children, headerAction }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-gold">
      {/* 키보드 사용자가 머리글을 건너뛰고 본문으로 바로 가는 링크 (포커스를 받을 때만 보임) */}
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>

      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-8">
        <Card as="header" className="flex flex-wrap items-center justify-between gap-3 !py-3">
          <p className="text-lg font-bold">오늘컨디션</p>
          {headerAction ? <nav aria-label="바로 가기" className="flex flex-wrap items-center gap-2">{headerAction}</nav> : null}
        </Card>

        <main id="main" tabIndex={-1} className="flex flex-col gap-4 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}
