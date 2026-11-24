import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { checkins, users } from "../db/schema";
import {
  saveCheckinRecord,
  saveCheckinSchema,
  saveFeedbackRecord,
  saveFeedbackSchema,
  saveSuggestionRecord,
  saveSuggestionSchema,
} from "../lib/checkins/save";
import { createEmptySoreness } from "../lib/domain/score";
import type { CheckinInput } from "../lib/domain/types";
import { createUser } from "../lib/auth/signup";
import { parseSignupForm } from "../lib/auth/validation";

let pg: PGlite;
let db: ReturnType<typeof drizzle>;
let userA: string;
let userB: string;

const input: CheckinInput = {
  sleepBand: 4,
  sleepQuality: 4,
  fatigue: 2,
  soreness: { ...createEmptySoreness(), lower: 4 },
  mood: 4,
  yesterdayLoad: 3,
};
const day1 = new Date("2026-11-24T08:00:00+09:00");
const day2 = new Date("2026-11-25T08:00:00+09:00");

const goodSuggestion = {
  type: "strength",
  minutes: 40,
  targetParts: ["shoulder", "back", "arm", "chest"],
  restParts: ["lower"],
  message: "상체 위주로 40분 근력 운동을 해 보세요.",
};

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

const rows = () => db.select().from(checkins);

describe("입력 검사", () => {
  it("올바른 값은 통과, 범위 밖·소요 시간 이상값은 거부", () => {
    expect(saveCheckinSchema.safeParse({ level: "hobby", checkin: input }).success).toBe(true);
    expect(saveCheckinSchema.safeParse({ level: "hobby", checkin: input, durationSeconds: 42 }).success).toBe(true);
    expect(saveCheckinSchema.safeParse({ level: "hobby", checkin: input, durationSeconds: -1 }).success).toBe(false);
    expect(saveCheckinSchema.safeParse({ level: "hobby", checkin: { ...input, mood: 9 } }).success).toBe(false);
    expect(saveSuggestionSchema.safeParse({ checkinDate: "2026-11-24", source: "ai", suggestion: {} }).success).toBe(true);
    expect(saveSuggestionSchema.safeParse({ checkinDate: "내일", source: "ai", suggestion: {} }).success).toBe(false);
    expect(saveSuggestionSchema.safeParse({ checkinDate: "2026-11-24", source: "human", suggestion: {} }).success).toBe(false);
  });
});

describe("체크인 기록 저장", () => {
  it("점수·강도를 서버가 계산해 오늘(한국 시간) 기록을 만든다", async () => {
    const result = await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input, durationSeconds: 45 }, day1);
    expect(result).toEqual({ checkinDate: "2026-11-24", score: 71, intensity: "moderate" });
    const [row] = await rows();
    expect(row.score).toBe(71);
    expect(row.intensity).toBe("moderate");
    expect(row.durationSeconds).toBe(45);
    expect(row.soreness).toEqual(input.soreness);
    expect(row.suggestion).toBeNull();
  });

  it("한국 시간 기준으로 날짜가 정해진다 (UTC 전날 오후 = 한국 다음 날 아침)", async () => {
    const result = await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, new Date("2026-11-24T16:00:00Z"));
    expect(result.checkinDate).toBe("2026-11-25");
  });

  it("같은 날 다시 하면 새 기록이 아니라 수정되고, 이전 제안·평가·표시 여부가 지워진다", async () => {
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day1);
    await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion });
    await pg.exec("UPDATE checkins SET feedback = 'up', suggestion_viewed = true");

    const better = { ...input, soreness: createEmptySoreness(), fatigue: 1 as const };
    await saveCheckinRecord(db, { userId: userA, level: "athlete", checkin: better }, new Date("2026-11-24T20:00:00+09:00"));

    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].fatigue).toBe(1);
    expect(all[0].level).toBe("athlete");
    expect(all[0].suggestion).toBeNull();
    expect(all[0].suggestionSource).toBeNull();
    expect(all[0].feedback).toBeNull();
    expect(all[0].suggestionViewed).toBe(false);
  });

  it("다음 날 하면 새 기록이 생긴다", async () => {
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day1);
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day2);
    expect(await rows()).toHaveLength(2);
  });

  it("마지막 운동 수준이 계정에 기억된다", async () => {
    await saveCheckinRecord(db, { userId: userA, level: "athlete", checkin: input }, day1);
    const [user] = await db.select().from(users).where((await import("drizzle-orm")).eq(users.id, userA));
    expect(user.level).toBe("athlete");
  });

  it("사용자마다 따로 저장된다", async () => {
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day1);
    await saveCheckinRecord(db, { userId: userB, level: "hobby", checkin: input }, day1);
    expect(await rows()).toHaveLength(2);
  });

  it("존재하지 않는 계정(삭제된 계정의 세션)으로는 저장되지 않는다", async () => {
    await expect(
      saveCheckinRecord(db, { userId: "00000000-0000-0000-0000-000000000000", level: "hobby", checkin: input }, day1),
    ).rejects.toThrow();
    expect(await rows()).toHaveLength(0);
  });
});

describe("제안 저장 (서버 재검사)", () => {
  beforeEach(async () => {
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day1);
  });

  it("규칙을 지킨 AI 제안은 그대로 저장된다", async () => {
    const result = await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion });
    expect(result).toEqual({ status: "saved", source: "ai" });
    const [row] = await rows();
    expect(row.suggestionSource).toBe("ai");
    expect(row.suggestion?.minutes).toBe(40);
  });

  it("규칙을 어긴 제안(시간 초과·쉬는 부위 사용·금지어)은 기본 문구와 fallback으로 바꿔 저장한다", async () => {
    for (const bad of [
      { ...goodSuggestion, minutes: 120 },
      { ...goodSuggestion, targetParts: ["lower"] },
      { ...goodSuggestion, message: "디스크 치료에 좋아요" },
      { ...goodSuggestion, type: "yoga" },
      "문장",
    ]) {
      const result = await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: bad });
      expect(result).toEqual({ status: "saved", source: "fallback" });
      const [row] = await rows();
      expect(row.suggestionSource).toBe("fallback");
      expect(row.suggestion?.restParts).toEqual(["lower"]);
      expect(row.suggestion?.targetParts).not.toContain("lower");
      expect(row.suggestion?.message).not.toContain("디스크");
    }
  });

  it("다른 사람의 기록이나 없는 날짜에는 붙일 수 없다", async () => {
    expect(await saveSuggestionRecord(db, { userId: userB, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion })).toEqual({ status: "no_checkin" });
    expect(await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-30", source: "ai", suggestion: goodSuggestion })).toEqual({ status: "no_checkin" });
    const [row] = await rows();
    expect(row.suggestion).toBeNull();
  });

  it("화면이 fallback이라고 알린 제안도 같은 검사를 거친다", async () => {
    const result = await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "fallback", suggestion: goodSuggestion });
    expect(result).toEqual({ status: "saved", source: "fallback" });
  });
}, 30000);

describe("제안 평가 저장 (👍/👎)", () => {
  beforeEach(async () => {
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, day1);
  });

  it("입력 검사: up/down만 허용", () => {
    expect(saveFeedbackSchema.safeParse({ checkinDate: "2026-11-24", feedback: "up" }).success).toBe(true);
    expect(saveFeedbackSchema.safeParse({ checkinDate: "2026-11-24", feedback: "meh" }).success).toBe(false);
    expect(saveFeedbackSchema.safeParse({ checkinDate: "오늘", feedback: "up" }).success).toBe(false);
  });

  it("제안이 저장된 기록에는 평가가 저장되고, 다시 누르면 바뀐다", async () => {
    await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion });
    expect(await saveFeedbackRecord(db, { userId: userA, checkinDate: "2026-11-24", feedback: "up" })).toEqual({ status: "saved" });
    expect((await rows())[0].feedback).toBe("up");
    await saveFeedbackRecord(db, { userId: userA, checkinDate: "2026-11-24", feedback: "down" });
    expect((await rows())[0].feedback).toBe("down");
  });

  it("평가할 제안이 아직 없으면 저장하지 않는다", async () => {
    expect(await saveFeedbackRecord(db, { userId: userA, checkinDate: "2026-11-24", feedback: "up" })).toEqual({ status: "no_suggestion" });
    expect((await rows())[0].feedback).toBeNull();
  });

  it("다른 사람의 기록이나 없는 날짜에는 저장할 수 없다", async () => {
    await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion });
    expect((await saveFeedbackRecord(db, { userId: userB, checkinDate: "2026-11-24", feedback: "down" })).status).toBe("no_suggestion");
    expect((await saveFeedbackRecord(db, { userId: userA, checkinDate: "2026-11-30", feedback: "down" })).status).toBe("no_suggestion");
    expect((await rows())[0].feedback).toBeNull();
  });

  it("같은 날 다시 체크인하면 평가가 지워진다", async () => {
    await saveSuggestionRecord(db, { userId: userA, checkinDate: "2026-11-24", source: "ai", suggestion: goodSuggestion });
    await saveFeedbackRecord(db, { userId: userA, checkinDate: "2026-11-24", feedback: "up" });
    await saveCheckinRecord(db, { userId: userA, level: "hobby", checkin: input }, new Date("2026-11-24T21:00:00+09:00"));
    expect((await rows())[0].feedback).toBeNull();
  });
}, 30000);
