import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

// 작업 5번: 공통 화면 틀이 제대로 보이는지 확인하는 임시 첫 화면.
// 작업 6번에서 체크인 화면으로 바뀐다.
export default function Home() {
  return (
    <AppShell>
      <Card>
        <h1 className="text-2xl font-bold">오늘컨디션</h1>
        <p className="mt-2">아침 1분 체크인으로 오늘의 컨디션 점수와 알맞은 운동 강도를 알려 드려요.</p>
        <p className="mt-2 text-ink-sub">체크인 화면은 곧 만들어져요. 지금은 화면 틀(색·글자·버튼)만 확인할 수 있어요.</p>
      </Card>

      <Card aria-labelledby="frame-check">
        <h2 id="frame-check" className="text-lg font-bold">화면 틀 확인</h2>
        <p className="mt-1 text-ink-sub">버튼은 높이 44px 이상이고, 키보드로 이동하면 진한 테두리가 보여요.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button>주요 버튼</Button>
          <Button variant="secondary">보조 버튼</Button>
        </div>
      </Card>
    </AppShell>
  );
}
