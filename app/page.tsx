import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { CheckinScreen } from "@/components/CheckinScreen";

// "/" 첫 화면: 체크인 입력 → 결과(점수·제안·안내). 머리글에서 회원가입으로 갈 수 있다. (로그인 상태에 따른 표시는 작업 13번)
export default function Home() {
  return (
    <AppShell
      headerAction={
        <Link href="/signup" className={buttonClassName("secondary")}>
          회원가입
        </Link>
      }
    >
      <CheckinScreen />
    </AppShell>
  );
}
