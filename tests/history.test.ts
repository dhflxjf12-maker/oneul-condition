import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { createUser } from "../lib/auth/signup";
import { parseSignupForm } from "../lib/auth/validation";
import { saveCheckinRecord } from "../lib/checkins/save";
import { buildWeekSeries, calculateTrend } from "../lib/domain/trend";
import { createEmptySoreness } from "../lib/domain/score";
import type { CheckinInput } from "../lib/domain/types";
import { loadRecentHistory } from "../lib/history/load";

let pg: PGlite;
let db: ReturnType<typeof drizzle>;
let userA: string;
let userB: string;

const input: CheckinInput = {
  sleepBand: 4,
  sleepQuality: 4,
  fatigue: 2,
  soreness: createEmptySoreness(),
  mood: 4,
  yesterdayLoad: 3,
};
const kst = (date: string) => new Date(`${date}T09:00:00+09:00`);
const NOW = kst("2026-11-24");

async function signup(email: string): Promise<string> {
  const parsed = parseSignupForm({ email, password: "abcd1234", ageConfirmed: "on", healthConsent: "on" });
  if (!parsed.ok) throw new Error("준비 실패");
  const result = await createUser(db, parsed.data);
  if (result.status !== "created") throw new Error("준비 실패");
  return result.userId;
}

beforeAll(async () => {
  pg = new PGlite();
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  await applyMigrations(
    { exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] },
    dir,
  );
  db = drizzle(pg);
  userA = await signup("a@example.com");
  userB = await signup("b@example.com");
}, 60000);

beforeEach(async () => {
  await pg.exec("DELETE FROM checkins");
});

describe("기록 조회", () => {
  it("오늘 포함 14일 안의 내 기록만 최신순으로 읽는다", async () => {
    for (const date of ["2026-11-10", "2026-11-11", "2026-11-20", "2026-11-24"]) {
      await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, kst(date));
    }
    const { today, rows } = await loadRecentHistory(db, userA, NOW);
    expect(today).toBe("2026-11-24");
    // 14일 창은 11-11 ~ 11-24 (11-10은 밖)
    expect(rows.map((r) => r.date)).toEqual(["2026-11-24", "2026-11-20", "2026-11-11"]);
    // 손계산: (2000+1125+1500+1500+750+1400)/100 = 82.75 → 83
    expect(rows[0]).toMatchObject({ score: 83, intensity: "high" });
  });

  it("다른 사람의 기록은 읽지 않는다", async () => {
    await saveCheckinRecord(db, { userId: userB, level: "hobby", checkin: input }, kst("2026-11-24"));
    expect((await loadRecentHistory(db, userA, NOW)).rows).toHaveLength(0);
    expect((await loadRecentHistory(db, userB, NOW)).rows).toHaveLength(1);
  });

  it("기록이 7일 쌓이면 예상이 나오고, 6일이면 모으는 중이다", async () => {
    for (let i = 0; i < 6; i++) {
      await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, kst(`2026-11-${24 - i}`));
    }
    let { today, rows } = await loadRecentHistory(db, userA, NOW);
    expect(calculateTrend(rows, today)).toEqual({ status: "collecting", recordCount: 6 });
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, kst("2026-11-18"));
    ({ today, rows } = await loadRecentHistory(db, userA, NOW));
    expect(calculateTrend(rows, today)).toMatchObject({ status: "ready", label: "similar" });
    expect(buildWeekSeries(rows, today).filter((p) => p.score !== null)).toHaveLength(7);
  });
}, 30000);
