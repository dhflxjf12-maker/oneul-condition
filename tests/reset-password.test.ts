import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { loginAttempts, users } from "../db/schema";
import { hashEmail } from "../lib/auth/email-hash";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { generateTempPassword, resetPassword, TEMP_PASSWORD_LENGTH } from "../scripts/reset-password-core.mjs";

// 관리자 비밀번호 초기화(DESIGN 4.5): 임시 비밀번호로 로그인되고, 기존 세션이 끊기고, 잠금이 풀리는지 확인한다.

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
let pg: PGlite;
let db: ReturnType<typeof drizzle>;
const adapter = () => ({ query: async (text: string, params?: unknown[]) => (await pg.query(text, params)).rows as Record<string, unknown>[] });

beforeAll(async () => {
  pg = new PGlite();
  await applyMigrations({ exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] }, migrationsDir);
  db = drizzle(pg);
}, 60000);

afterEach(() => {
  delete process.env.EMAIL_HASH_SECRET;
});

async function addUser(email: string) {
  const [row] = await db
    .insert(users)
    .values({ email, passwordHash: await hashPassword("옛날비밀번호123"), healthConsentAt: new Date(), ageConfirmed: true })
    .returning();
  return row;
}

describe("임시 비밀번호", () => {
  it("16자이고 헷갈리는 글자가 없으며 매번 다르다", () => {
    const a = generateTempPassword();
    expect(a).toHaveLength(TEMP_PASSWORD_LENGTH);
    expect(a).toMatch(/^[a-zA-Z2-9]+$/);
    expect(a).not.toMatch(/[0OlI1]/);
    expect(generateTempPassword()).not.toBe(a);
  });
});

describe("resetPassword", () => {
  it("서버의 verifyPassword 로 임시 비밀번호가 맞고, 옛 비밀번호는 틀린다", async () => {
    const user = await addUser("reset1@example.com");
    const result = await resetPassword(adapter(), "reset1@example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(result.tempPassword, row.passwordHash)).toBe(true);
    expect(await verifyPassword("옛날비밀번호123", row.passwordHash)).toBe(false);
  });

  it("기존 로그인을 끊는다(session_version +1)", async () => {
    const user = await addUser("reset2@example.com");
    await resetPassword(adapter(), "reset2@example.com");
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.sessionVersion).toBe(user.sessionVersion + 1);
  });

  it("이메일의 대소문자·공백은 무시하고, 다른 계정은 건드리지 않는다", async () => {
    const other = await addUser("other@example.com");
    await addUser("reset3@example.com");
    const result = await resetPassword(adapter(), "  Reset3@Example.com ");
    expect(result.ok).toBe(true);
    const [row] = await db.select().from(users).where(eq(users.id, other.id));
    expect(row.passwordHash).toBe(other.passwordHash);
    expect(row.sessionVersion).toBe(other.sessionVersion);
  });

  it("가입되지 않은 이메일·잘못된 형식은 실패한다", async () => {
    expect(await resetPassword(adapter(), "nobody@example.com")).toEqual({ ok: false, reason: "not-found" });
    expect(await resetPassword(adapter(), "이메일아님")).toEqual({ ok: false, reason: "invalid-email" });
  });

  it("EMAIL_HASH_SECRET 이 있으면 로그인 잠금도 푼다(서버의 hashEmail 과 같은 값)", async () => {
    process.env.EMAIL_HASH_SECRET = "x".repeat(40);
    await addUser("locked@example.com");
    const emailHash = hashEmail("locked@example.com");
    await db.insert(loginAttempts).values({ emailHash, failedCount: 5, lockedUntil: new Date(Date.now() + 600000) });
    const result = await resetPassword(adapter(), "locked@example.com");
    expect(result.ok && result.lockCleared).toBe(true);
    expect(await db.select().from(loginAttempts).where(eq(loginAttempts.emailHash, emailHash))).toHaveLength(0);
  });

  it("키가 없으면 잠금은 건드리지 않고 알린다", async () => {
    await addUser("nokey@example.com");
    const result = await resetPassword(adapter(), "nokey@example.com");
    expect(result.ok && result.lockCleared).toBe(false);
  });
});
