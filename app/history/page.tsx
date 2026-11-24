import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { buttonClassName } from "@/components/Button";
import { Card } from "@/components/Card";
import { ForecastCard } from "@/components/ForecastCard";
import { SafetyNotice } from "@/components/SafetyNotice";
import { TrendChart, type WeekPoint } from "@/components/TrendChart";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { buildWeekSeries, calculateTrend } from "@/lib/domain/trend";
import { loadRecentHistory } from "@/lib/history/load";

// Design Ref: §5.1 — /history 기록·추이 화면 (로그인한 본인 기록만). 로그인하지 않았으면 로그인 화면으로 보낸다.
// 최근 7일 점수는 기록이 있으면 항상 보여 주고, 기복 예상은 최근 14일 중 7일 이상일 때만 보여 준다.

export const metadata = { title: "기록 · 오늘컨디션" };

/** 로그인 상태와 기록은 요청마다 달라서 <Suspense> 안에서 읽는다. */
async function HistoryContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let data: Awaited<ReturnType<typeof loadRecentHistory>>;
  try {
    data = await loadRecentHistory(getDb(), user.id);
  } catch {
    return (
      <Card as="div">
        <p role="alert" className="font-semibold text-danger">
          <span aria-hidden="true">⚠ </span>
          기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  const records = data.rows.map((row) => ({ date: row.date, score: row.score }));
  const intensityByDate = new Map(data.rows.map((row) => [row.date, row.intensity]));
  const points: WeekPoint[] = buildWeekSeries(records, data.today).map((point) => ({
    ...point,
    intensity: intensityByDate.get(point.date) ?? null,
  }));

  return (
    <>
      <TrendChart points={points} today={data.today} />
      <ForecastCard trend={calculateTrend(records, data.today)} />
      <SafetyNotice />
    </>
  );
}

export default function HistoryPage() {
  return (
    <AppShell
      headerAction={
        <Link href="/" className={buttonClassName("secondary")}>
          체크인으로
        </Link>
      }
    >
      <Card as="div">
        <h1 className="text-xl font-bold">기록</h1>
      </Card>
      <Suspense fallback={<Card as="div">불러오는 중…</Card>}>
        <HistoryContent />
      </Suspense>
    </AppShell>
  );
}
