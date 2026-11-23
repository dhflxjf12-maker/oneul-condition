import { AppShell } from "@/components/AppShell";
import { CheckinScreen } from "@/components/CheckinScreen";

// "/" 첫 화면: 체크인 입력 → (임시) 결과. 점수 화면은 작업 8번에서 제대로 만든다.
export default function Home() {
  return (
    <AppShell>
      <CheckinScreen />
    </AppShell>
  );
}
