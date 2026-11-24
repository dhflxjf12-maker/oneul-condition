import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";
import { LoginForm } from "@/components/LoginForm";

// Design Ref: §5.1 — /login 로그인. 로그인은 선택이라 체크인 화면으로 돌아가는 링크와 가입 링크를 둔다.

export const metadata = { title: "로그인 · 오늘컨디션" };

export default function LoginPage() {
  return (
    <AppShell
      headerAction={
        <Link href="/" className={buttonClassName("secondary")}>
          체크인으로
        </Link>
      }
    >
      <Card as="div">
        <h1 className="text-xl font-bold">로그인</h1>
        <p className="mt-1 text-ink-sub">
          로그인하지 않아도 점수와 제안은 볼 수 있어요. 처음이라면{" "}
          <Link href="/signup" className="font-semibold text-accent underline">
            회원가입
          </Link>
          을 해 주세요.
        </p>
      </Card>
      <LoginForm />
    </AppShell>
  );
}
