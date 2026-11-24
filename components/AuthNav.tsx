import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buttonClassName } from "./Button";

// Design Ref: §5.1 — 머리글 오른쪽: 로그인했으면 [로그아웃], 아니면 [로그인]·[회원가입].
// 로그인 상태는 요청마다 달라서, 이 부품을 쓰는 곳에서 <Suspense>로 감싸 나머지 화면은 미리 만들어 둔 채로 둔다.

/** 머리글의 로그인 상태 표시 */
export async function AuthNav() {
  const user = await getCurrentUser();

  if (user) {
    return (
      <>
        <Link href="/account" className={buttonClassName("secondary")}>
          계정
        </Link>
        <form action={logout}>
          <button type="submit" className={buttonClassName("secondary")}>
            로그아웃
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={buttonClassName("secondary")}>
        로그인
      </Link>
      <Link href="/signup" className={buttonClassName("secondary")}>
        회원가입
      </Link>
    </>
  );
}

/** 로그인 상태를 알아내는 동안 보여 줄 자리 (버튼 크기와 같은 빈 칸, 화면이 덜컥 움직이지 않게) */
export function AuthNavFallback() {
  return <span aria-hidden="true" className="inline-block min-h-11 min-w-24" />;
}
