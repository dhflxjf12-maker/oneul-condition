import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { aiCalls, checkins, loginAttempts, surveyResponses, users } from "../db/schema";
import type { Soreness } from "../lib/domain/types";
import { tryConsumeInDb } from "../lib/suggestion/db-counter";

// 실제 Postgres와 같은 엔진(PGlite, 메모리 안)에 마이그레이션을 적용해서 표 구조·제약·한도 SQL을 확인한다.
// 외부 데이터베이스나 .env 값은 필요 없다.

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

let pg: PGlite;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations({ exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] }, migrationsDir);
  db = drizzle(pg);
}, 60000);

async function insertUser(email: string) {
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash: "해시", healthConsentAt: new Date(), ageConfirmed: true })
    .returning();
  return row;
}

const sampleCheckin = {
  checkinDate: "2026-11-24",
  sleepBand: 4,
  sleepQuality: 4,
  fatigue: 2,
  soreness: { shoulder: 0, back: 0, arm: 0, chest: 0, abdomen: 0, lower: 4 } as Soreness,
  mood: 4,
  yesterdayLoad: 3,
  level: "hobby" as const,
  score: 71,
  intensity: "moderate" as const,
};

describe("마이그레이션", () => {
  it("다시 실행해도 이미 적용한 파일은 건너뛴다", async () => {
    const again = await applyMigrations(
      { exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] },
      migrationsDir,
    );
    expect(again).toEqual([]);
  });

  it("schema.ts의 열 이름이 실제 표와 모두 같다", async () => {
    for (const table of [users, checkins, surveyResponses, aiCalls, loginAttempts]) {
      const config = getTableConfig(table);
      const result = await pg.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
        [config.name],
      );
      const actual = result.rows.map((row) => row.column_name).sort();
      const expected = config.columns.map((column) => column.name).sort();
      expect(actual, `${config.name} 표`).toEqual(expected);
    }
  });
});

describe("표 제약", () => {
  it("같은 이메일로 두 번 가입할 수 없다", async () => {
    await insertUser("dup@example.test");
    await expect(insertUser("dup@example.test")).rejects.toThrow();
  });

  it("같은 날 체크인은 한 건만 만들 수 있다", async () => {
    const user = await insertUser("day@example.test");
    await db.insert(checkins).values({ userId: user.id, ...sampleCheckin });
    await expect(db.insert(checkins).values({ userId: user.id, ...sampleCheckin })).rejects.toThrow();
  });

  it("범위 밖 값(점수 101, 항목 6)은 거부한다", async () => {
    const user = await insertUser("range@example.test");
    await expect(
      db.insert(checkins).values({ userId: user.id, ...sampleCheckin, checkinDate: "2026-11-25", score: 101 }),
    ).rejects.toThrow();
    await expect(
      db.insert(checkins).values({ userId: user.id, ...sampleCheckin, checkinDate: "2026-11-26", mood: 6 }),
    ).rejects.toThrow();
  });

  it("계정을 지우면 그 계정의 기록·체감 응답도 함께 지워진다", async () => {
    const user = await insertUser("cascade@example.test");
    await db.insert(checkins).values({ userId: user.id, ...sampleCheckin });
    await db.insert(surveyResponses).values({ userId: user.id, weekStart: "2026-11-16" });
    await pg.query("DELETE FROM users WHERE id = $1", [user.id]);
    const left = await pg.query("SELECT 1 FROM checkins WHERE user_id = $1 UNION ALL SELECT 1 FROM survey_responses WHERE user_id = $1", [user.id]);
    expect(left.rows).toHaveLength(0);
  });

  it("같은 이메일 해시는 한 줄만 둔다 (로그인 시도 기록)", async () => {
    await db.insert(loginAttempts).values({ emailHash: "abc" });
    await expect(db.insert(loginAttempts).values({ emailHash: "abc" })).rejects.toThrow();
  });
});

describe("AI 호출 한도 (ai_calls)", () => {
  const now = new Date("2026-11-24T10:00:00+09:00");

  it("20번까지 허용하고 21번째는 거부한다", async () => {
    for (let i = 0; i < 20; i++) expect(await tryConsumeInDb(db, "device:a", 20, now)).toBe(true);
    expect(await tryConsumeInDb(db, "device:a", 20, now)).toBe(false);
    const row = await pg.query<{ count: number }>("SELECT count FROM ai_calls WHERE subject_key = 'device:a'");
    expect(row.rows[0].count).toBe(20); // 거부된 호출은 횟수를 올리지 않는다
  });

  it("다른 기기는 따로 센다", async () => {
    expect(await tryConsumeInDb(db, "device:b", 20, now)).toBe(true);
  });

  it("동시에 30번 요청해도 정확히 한도(20)까지만 허용한다", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => tryConsumeInDb(db, "device:race", 20, now)));
    expect(results.filter(Boolean)).toHaveLength(20);
  });

  it("한국 시간 날짜가 바뀌면 다시 센다", async () => {
    const next = new Date("2026-11-25T00:10:00+09:00");
    expect(await tryConsumeInDb(db, "device:a", 20, next)).toBe(true);
  });

  it("7일이 지난 기록은 그날의 첫 호출 때 함께 지운다", async () => {
    await pg.query("INSERT INTO ai_calls (subject_key, call_date, count) VALUES ('old', '2026-11-01', 3)");
    await tryConsumeInDb(db, "device:fresh", 20, now);
    const old = await pg.query("SELECT 1 FROM ai_calls WHERE subject_key = 'old'");
    expect(old.rows).toHaveLength(0);
  });
});
