import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { loginAttempts } from "../db/schema";
import { hashEmail, isEmailHashConfigured } from "../lib/auth/email-hash";
import { attemptLogin } from "../lib/auth/login";
import { createUser } from "../lib/auth/signup";
import { LOGIN_FAILED_MESSAGE, parseLoginForm, parseSignupForm } from "../lib/auth/validation";

const TEST_SECRET = "email-hash-secret-email-hash-secret-12";
let pg: PGlite;
let db: ReturnType<typeof drizzle>;
const T0 = new Date("2026-11-24T10:00:00Z");
const minutes = (n: number) => new Date(T0.getTime() + n * 60 * 1000);

beforeAll(async () => {
  process.env.EMAIL_HASH_SECRET = TEST_SECRET;
  pg = new PGlite();
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  await applyMigrations(
    { exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] },
    dir,
  );
  db = drizzle(pg);
  const parsed = parseSignupForm({ email: "member@example.com", password: "abcd1234", ageConfirmed: "on", healthConsent: "on" });
  if (!parsed.ok) throw new Error("준비 실패");
  await createUser(db, parsed.data);
}, 60000);

beforeEach(async () => {
  process.env.EMAIL_HASH_SECRET = TEST_SECRET;
  await pg.exec("DELETE FROM login_attempts");
});

afterEach(() => {
  process.env.EMAIL_HASH_SECRET = TEST_SECRET;
});

const login = (email: string, password: string, now = T0) =>
  attemptLogin(db, { email, emailHash: hashEmail(email), password }, now);

describe("로그인 폼 검사", () => {
  it("비어 있으면 입력 안내, 형식이 이상해도 통일된 실패로 다룬다", () => {
    expect(parseLoginForm({ email: "", password: "x" }).ok).toBe(false);
    expect(parseLoginForm({ email: "A@B.com ", password: "x" })).toEqual({ ok: true, email: "a@b.com", password: "x" });
    expect(parseLoginForm({ email: "그냥글자", password: "x" }).ok).toBe(true);
    const long = parseLoginForm({ email: "a".repeat(300), password: "x" });
    expect(!long.ok && long.message).toBe(LOGIN_FAILED_MESSAGE);
  });
});

describe("이메일 해시", () => {
  it("대소문자와 상관없이 같고, 원문이 없고, 키가 다르면 달라진다", () => {
    const a = hashEmail("Member@Example.com");
    expect(a).toBe(hashEmail("member@example.com"));
    expect(a).not.toContain("member");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    process.env.EMAIL_HASH_SECRET = "other-secret-other-secret-other-secret-9";
    expect(hashEmail("member@example.com")).not.toBe(a);
  });

  it("키가 없거나 짧으면 설정 안 됨", () => {
    delete process.env.EMAIL_HASH_SECRET;
    expect(isEmailHashConfigured()).toBe(false);
    expect(() => hashEmail("a@b.com")).toThrow();
  });
});

describe("로그인", () => {
  it("맞는 이메일·비밀번호는 성공하고 실패 기록이 지워진다", async () => {
    await login("member@example.com", "틀림틀림틀림");
    const ok = await login("member@example.com", "abcd1234");
    expect(ok.status).toBe("success");
    expect((await db.select().from(loginAttempts)).length).toBe(0);
  });

  it("비밀번호 틀림과 가입 안 한 이메일은 같은 결과(invalid)다", async () => {
    expect(await login("member@example.com", "wrongwrong")).toEqual({ status: "invalid" });
    expect(await login("nobody@example.com", "abcd1234")).toEqual({ status: "invalid" });
  });

  it("5회 연속 실패하면 10분 잠기고, 잠금 중에는 맞는 비밀번호도 거부한다", async () => {
    for (let i = 0; i < 4; i++) {
      expect((await login("member@example.com", "wrongwrong", minutes(i * 0.1))).status).toBe("invalid");
    }
    expect(await login("member@example.com", "wrongwrong", minutes(0.5))).toEqual({ status: "locked", remainingSeconds: 600 });
    const during = await login("member@example.com", "abcd1234", minutes(5.5));
    expect(during).toEqual({ status: "locked", remainingSeconds: 300 }); // 잠금은 0.5분에 걸렸으니 10.5분에 풀린다
  });

  it("가입하지 않은 이메일도 똑같이 5회 실패로 잠긴다 (가입 여부를 알 수 없다)", async () => {
    for (let i = 0; i < 4; i++) await login("nobody@example.com", "wrongwrong", minutes(i * 0.1));
    expect(await login("nobody@example.com", "wrongwrong", minutes(0.5))).toEqual({ status: "locked", remainingSeconds: 600 });
    expect((await login("nobody@example.com", "abcd1234", minutes(5))).status).toBe("locked");
  });

  it("잠금이 풀린 직후 1번 실패하면 바로 다시 잠기지 않고 1회부터 센다", async () => {
    for (let i = 0; i < 5; i++) await login("member@example.com", "wrongwrong", minutes(0));
    expect(await login("member@example.com", "wrongwrong", minutes(10.5))).toEqual({ status: "invalid" });
    const [row] = await db.select().from(loginAttempts);
    expect(row.failedCount).toBe(1);
    expect(row.lockedUntil).toBeNull();
  });

  it("잠금이 풀린 뒤에는 맞는 비밀번호로 로그인할 수 있다", async () => {
    for (let i = 0; i < 5; i++) await login("member@example.com", "wrongwrong", minutes(0));
    expect((await login("member@example.com", "abcd1234", minutes(10.5))).status).toBe("success");
  });

  it("마지막 실패로부터 24시간이 지나면 실패 횟수를 0으로 되돌린다", async () => {
    for (let i = 0; i < 4; i++) await login("member@example.com", "wrongwrong", minutes(0));
    await login("member@example.com", "wrongwrong", minutes(24 * 60 + 1));
    const [row] = await db.select().from(loginAttempts);
    expect(row.failedCount).toBe(1);
  });

  it("이메일 원문은 저장하지 않고 해시만 저장한다", async () => {
    await login("member@example.com", "wrongwrong");
    const [row] = await db.select().from(loginAttempts);
    expect(row.emailHash).toBe(hashEmail("member@example.com"));
    expect(JSON.stringify(row)).not.toContain("member@");
  });

  it("오래된 기록은 실패가 생길 때 함께 지운다", async () => {
    await pg.exec("INSERT INTO login_attempts (email_hash, failed_count, last_failed_at) VALUES ('old', 2, '2026-11-01T00:00:00Z')");
    await login("member@example.com", "wrongwrong");
    const rows = await db.select().from(loginAttempts);
    expect(rows.map((r) => r.emailHash)).not.toContain("old");
  });

  it("동시에 5번 실패해도 횟수가 정확히 5가 되어 잠긴다", async () => {
    await Promise.all(Array.from({ length: 5 }, () => login("member@example.com", "wrongwrong")));
    const [row] = await db.select().from(loginAttempts);
    expect(row.failedCount).toBe(5);
    expect(row.lockedUntil).not.toBeNull();
  });
}, 60000);
