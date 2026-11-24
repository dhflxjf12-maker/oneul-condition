import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";

// 없는 주소로 들어왔을 때 보여 주는 화면. 첫 화면으로 돌아가는 길을 안내한다.

export default function NotFound() {
  return (
    <AppShell>
      <Card as="div">
        <h1 className="text-xl font-bold">찾을 수 없는 페이지예요</h1>
        <p className="mt-2 text-ink-sub">주소가 바뀌었거나 잘못 입력했을 수 있어요.</p>
        <Link href="/" className={buttonClassName("primary", "mt-4")}>
          첫 화면으로
        </Link>
      </Card>
    </AppShell>
  );
}
