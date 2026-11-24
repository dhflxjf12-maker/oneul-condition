import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";
import { SignupForm } from "@/components/SignupForm";

// Design Ref: §5.1 — /signup 회원가입. 로그인은 선택이라 첫 화면으로 돌아가는 링크를 둔다.

export const metadata = { title: "회원가입 · 오늘컨디션" };

export default function SignupPage() {
  return (
    <AppShell
      headerAction={
        <Link href="/" className={buttonClassName("secondary")}>
          체크인으로
        </Link>
      }
    >
      <Card as="div">
        <h1 className="text-xl font-bold">회원가입</h1>
        <p className="mt-1 text-ink-sub">가입하면 체크인 기록이 계정에 저장돼서 기기를 바꿔도 이어져요. 로그인 없이도 점수와 제안은 볼 수 있어요.</p>
      </Card>
      <SignupForm />
    </AppShell>
  );
}
