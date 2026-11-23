import type { Metadata, Viewport } from "next";
import "./globals.css";

// Design Ref: §5.1 — 모든 화면이 공유하는 바깥 틀. 한국어 화면이므로 lang="ko".
export const metadata: Metadata = {
  title: "오늘컨디션",
  description: "아침 1분 체크인으로 오늘의 컨디션 점수와 알맞은 운동 강도를 알려 드려요.",
};

// 휴대폰 주소창 색을 화면 바탕(골드)과 맞춘다.
export const viewport: Viewport = {
  themeColor: "#e9b824",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
