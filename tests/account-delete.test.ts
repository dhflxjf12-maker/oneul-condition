import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { checkins, loginAttempts, surveyResponses, users } from "../db/schema";
import { deleteAccountRecord } from "../lib/accounts/delete";
import { createUser } from "../lib/auth/signup";
import { parseSignupForm } from "../lib/auth/validation";
import { saveCheckinRecord } from "../lib/checkins/save";
import { createEmptySoreness } from "../lib/domain/score";
import type { CheckinInput } from "../lib/domain/types";

let pg: PGlite;
let db: ReturnType<typeof drizzle>;

const input: CheckinInput = {
  sleepBand: 4,
  sleepQuality: 4,
  fatigue: 2,
  soreness: createEmptySoreness(),
  mood: 4,
  yesterdayLoad: 3,
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
}, 60000);

describe("계정 삭제", () => {
  it("계정과 체크인 기록·체감 응답·로그인 시도 기록이 함께 지워지고, 다른 사람 것은 남는다", async () => {
    const a = await signup("a@example.com");
    const b = await signup("b@example.com");
    for (const id of [a, b]) {
      await saveCheckinRecord(db, { userId: id, level: "hobby", checkin: input }, new Date("2026-11-24T09:00:00+09:00"));
      await db.insert(surveyResponses).values({ userId: id, weekStart: "2026-11-16" });
    }
    await db.insert(loginAttempts).values([{ emailHash: "hash-a" }, { emailHash: "hash-b" }]);

    expect(await deleteAccountRecord(db, { userId: a, emailHash: "hash-a" })).toBe(true);

    expect(await db.select().from(users).where(eq(users.id, a))).toHaveLength(0);
    const left = await pg.query("SELECT user_id FROM checkins UNION ALL SELECT user_id FROM survey_responses");
    expect(left.rows.map((r) => (r as { user_id: string }).user_id)).toEqual([b, b]);
    expect((await db.select().from(loginAttempts)).map((r) => r.emailHash)).toEqual(["hash-b"]);
    expect(await db.select().from(checkins)).toHaveLength(1);
  });

  it("이미 없는 계정이면 false이고 아무것도 지우지 않는다", async () => {
    const before = (await db.select().from(users)).length;
    expect(await deleteAccountRecord(db, { userId: "00000000-0000-0000-0000-000000000000", emailHash: null })).toBe(false);
    expect((await db.select().from(users)).length).toBe(before);
  });

  it("삭제한 이메일로 다시 가입할 수 있다", async () => {
    const id = await signup("again@example.com");
    await deleteAccountRecord(db, { userId: id, emailHash: null });
    const parsed = parseSignupForm({ email: "again@example.com", password: "abcd1234", ageConfirmed: "on", healthConsent: "on" });
    if (!parsed.ok) throw new Error("준비 실패");
    expect((await createUser(db, parsed.data)).status).toBe("created");
  });
}, 30000);
