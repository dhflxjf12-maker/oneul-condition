import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { surveyResponses } from "../db/schema";
import { createUser } from "../lib/auth/signup";
import { parseSignupForm } from "../lib/auth/validation";
import { saveCheckinRecord } from "../lib/checkins/save";
import { createEmptySoreness } from "../lib/domain/score";
import type { CheckinInput } from "../lib/domain/types";
import { addDays, getDueSurvey, lastWeekStart, mondayOf, saveSurveyRecord, saveSurveySchema } from "../lib/survey/weekly";

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

// 2026-11-23은 월요일 → 이번 주 월요일, 지난주 월요일은 2026-11-16
const kst = (date: string, time = "09:00:00") => new Date(`${date}T${time}+09:00`);
const checkin = (userId: string, date: string) =>
  saveCheckinRecord(db, { userId, level: "hobby", checkin: input }, kst(date));

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
  await pg.exec("DELETE FROM checkins; DELETE FROM survey_responses");
});

describe("주 계산 (월요일 시작)", () => {
  it("월~일 어느 날이든 그 주의 월요일을 구한다", () => {
    for (const day of ["2026-11-23", "2026-11-24", "2026-11-26", "2026-11-29"]) expect(mondayOf(day)).toBe("2026-11-23");
    expect(mondayOf("2026-11-30")).toBe("2026-11-30"); // 다음 월요일
    expect(mondayOf("2026-11-22")).toBe("2026-11-16"); // 일요일은 지난 주
  });

  it("지난주 월요일과 달/해 경계 계산", () => {
    expect(lastWeekStart("2026-11-26")).toBe("2026-11-16");
    expect(lastWeekStart("2026-01-01")).toBe("2025-12-22"); // 2026-01-01은 목요일
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("입력 검사", () => {
    expect(saveSurveySchema.safeParse({ weekStart: "2026-11-16", matched: true }).success).toBe(true);
    expect(saveSurveySchema.safeParse({ weekStart: "2026-11-16", matched: "yes" }).success).toBe(false);
    expect(saveSurveySchema.safeParse({ weekStart: "지난주", matched: true }).success).toBe(false);
  });
});

describe("체감 질문을 보여 줄지 판단", () => {
  it("지난주에 기록이 있고 오늘 체크인을 마쳤으면 묻고, 물어본 사실을 기록한다", async () => {
    await checkin(userA, "2026-11-18"); // 지난주 수요일
    await checkin(userA, "2026-11-24"); // 이번 주 화요일 (이번 주 첫 체크인)
    expect(await getDueSurvey(db, userA, kst("2026-11-24"))).toEqual({ weekStart: "2026-11-16" });
    const [row] = await db.select().from(surveyResponses);
    expect(row.weekStart).toBe("2026-11-16");
    expect(row.matched).toBeNull();
  });

  it("응답하지 않고 넘겨도 그 주에는 다시 묻지 않는다", async () => {
    await checkin(userA, "2026-11-18");
    await checkin(userA, "2026-11-24");
    expect(await getDueSurvey(db, userA, kst("2026-11-24"))).not.toBeNull();
    expect(await getDueSurvey(db, userA, kst("2026-11-24", "21:00:00"))).toBeNull();
    await checkin(userA, "2026-11-26");
    expect(await getDueSurvey(db, userA, kst("2026-11-26"))).toBeNull();
    expect(await db.select().from(surveyResponses)).toHaveLength(1);
  });

  it("지난주에 기록이 없으면 묻지 않는다 (지지난주 기록만 있어도)", async () => {
    await checkin(userA, "2026-11-10"); // 지지난주
    await checkin(userA, "2026-11-24");
    expect(await getDueSurvey(db, userA, kst("2026-11-24"))).toBeNull();
    expect(await db.select().from(surveyResponses)).toHaveLength(0);
  });

  it("지난주 월요일·일요일 기록은 지난주로 센다", async () => {
    await checkin(userA, "2026-11-22"); // 지난주 일요일
    await checkin(userA, "2026-11-23");
    expect(await getDueSurvey(db, userA, kst("2026-11-23"))).toEqual({ weekStart: "2026-11-16" });
  });

  it("오늘 체크인을 마치기 전에는 묻지 않는다", async () => {
    await checkin(userA, "2026-11-18");
    expect(await getDueSurvey(db, userA, kst("2026-11-24"))).toBeNull();
  });

  it("다음 주에는 새로 한 번 더 묻는다", async () => {
    await checkin(userA, "2026-11-18");
    await checkin(userA, "2026-11-24");
    await getDueSurvey(db, userA, kst("2026-11-24"));
    // 다음 주(11-30 시작) 첫 체크인: 지난주(11-23~29)에 기록(11-24)이 있으므로 새로 묻는다.
    await checkin(userA, "2026-12-01");
    expect(await getDueSurvey(db, userA, kst("2026-12-01"))).toEqual({ weekStart: "2026-11-23" });
    // 같은 주의 다음 체크인에서는 다시 묻지 않는다.
    await checkin(userA, "2026-12-02");
    expect(await getDueSurvey(db, userA, kst("2026-12-02"))).toBeNull();
    expect(await db.select().from(surveyResponses)).toHaveLength(2);
  });

  it("사용자마다 따로 판단한다", async () => {
    await checkin(userA, "2026-11-18");
    await checkin(userA, "2026-11-24");
    await checkin(userB, "2026-11-24");
    expect(await getDueSurvey(db, userB, kst("2026-11-24"))).toBeNull();
    expect(await getDueSurvey(db, userA, kst("2026-11-24"))).not.toBeNull();
  });

  it("동시에 여러 번 확인해도 한 번만 묻는다", async () => {
    await checkin(userA, "2026-11-18");
    await checkin(userA, "2026-11-24");
    const results = await Promise.all(Array.from({ length: 5 }, () => getDueSurvey(db, userA, kst("2026-11-24"))));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});

describe("응답 저장", () => {
  beforeEach(async () => {
    await checkin(userA, "2026-11-18");
    await checkin(userA, "2026-11-24");
    await getDueSurvey(db, userA, kst("2026-11-24"));
  });

  it("맞았다/아니다가 저장되고, 한 번 응답한 주는 바꿀 수 없다", async () => {
    expect(await saveSurveyRecord(db, { userId: userA, weekStart: "2026-11-16", matched: false })).toEqual({ status: "saved" });
    expect((await db.select().from(surveyResponses))[0].matched).toBe(false);
    expect((await saveSurveyRecord(db, { userId: userA, weekStart: "2026-11-16", matched: true })).status).toBe("not_asked");
    expect((await db.select().from(surveyResponses))[0].matched).toBe(false);
  });

  it("물어본 적 없는 주나 다른 사람의 질문에는 저장할 수 없다", async () => {
    expect((await saveSurveyRecord(db, { userId: userA, weekStart: "2026-11-09", matched: true })).status).toBe("not_asked");
    expect((await saveSurveyRecord(db, { userId: userB, weekStart: "2026-11-16", matched: true })).status).toBe("not_asked");
    expect((await db.select().from(surveyResponses))[0].matched).toBeNull();
  });
}, 30000);
