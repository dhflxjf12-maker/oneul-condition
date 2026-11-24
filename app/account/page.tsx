import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";
import { DeleteAccount } from "@/components/DeleteAccount";
import { getCurrentUser } from "@/lib/auth/current-user";

// Design Ref: §5.1 — /account 계정 화면: 로그아웃, 계정 삭제(한 번 더 확인). 로그인하지 않았으면 로그인 화면으로 보낸다.

export const metadata = { title: "계정 · 오늘컨디션" };

/** 로그인 상태는 요청마다 달라서 <Suspense> 안에서 읽는다. */
async function AccountContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Card as="div">
        <h1 className="text-xl font-bold">계정</h1>
        <p className="mt-2 text-ink-sub">로그인한 이메일</p>
        <p className="break-all text-lg font-semibold">{user.email}</p>
        <form action={logout} className="mt-4">
          <button type="submit" className={buttonClassName("secondary")}>
            로그아웃
          </button>
        </form>
      </Card>
      <DeleteAccount />
    </>
  );
}

export default function AccountPage() {
  return (
    <AppShell
      headerAction={
        <Link href="/" className={buttonClassName("secondary")}>
          체크인으로
        </Link>
      }
    >
      <Suspense fallback={<Card as="div">불러오는 중…</Card>}>
        <AccountContent />
      </Suspense>
    </AppShell>
  );
}
