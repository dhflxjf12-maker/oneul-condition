import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthNav, AuthNavFallback } from "@/components/AuthNav";
import { CheckinScreen } from "@/components/CheckinScreen";

// "/" 첫 화면: 체크인 입력 → 결과(점수·제안·안내). 머리글에는 로그인 상태에 따라 [로그인]·[회원가입] 또는 [로그아웃]이 보인다.
// 로그인 상태는 요청마다 달라서 <Suspense>로 감싸고, 체크인 화면은 그대로 미리 만들어 둔다.
export default function Home() {
  return (
    <AppShell
      headerAction={
        <Suspense fallback={<AuthNavFallback />}>
          <AuthNav />
        </Suspense>
      }
    >
      {/* 화면 읽기 프로그램이 페이지 제목을 알 수 있도록 하는 제목 (화면에는 보이지 않음) */}
      <h1 className="sr-only">오늘의 컨디션 체크인</h1>
      <CheckinScreen />
    </AppShell>
  );
}
