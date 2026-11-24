import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import { createUser } from "../lib/auth/signup";
import { decryptSession, encryptSession, isSessionConfigured } from "../lib/auth/token";
import { parseSignupForm } from "../lib/auth/validation";

const valid = { email: "User@Example.com ", password: "abcd1234", ageConfirmed: "on", healthConsent: "on" };

describe("가입 입력 검사", () => {
  it("올바른 값은 통과하고 이메일은 소문자·공백 제거로 맞춘다", () => {
    const result = parseSignupForm(valid);
    expect(result.ok && result.data.email).toBe("user@example.com");
  });

  it("비밀번호 7자는 거부, 8자는 허용", () => {
    const short = parseSignupForm({ ...valid, password: "abcd123" });
    expect(!short.ok && short.errors.password).toContain("8자 이상");
    expect(parseSignupForm({ ...valid, password: "abcd1234" }).ok).toBe(true);
  });

  it("비밀번호가 너무 길면 거부 (129자)", () => {
    expect(parseSignupForm({ ...valid, password: "a".repeat(129) }).ok).toBe(false);
    expect(parseSignupForm({ ...valid, password: "a".repeat(128) }).ok).toBe(true);
  });

  it("14세 확인이나 건강 정보 동의가 빠지면 가입할 수 없다", () => {
    const noAge = parseSignupForm({ ...valid, ageConfirmed: undefined });
    expect(!noAge.ok && noAge.errors.ageConfirmed).toContain("14세");
    const noConsent = parseSignupForm({ ...valid, healthConsent: undefined });
    expect(!noConsent.ok && noConsent.errors.healthConsent).toContain("동의");
    expect(parseSignupForm({ ...valid, ageConfirmed: "off" }).ok).toBe(false);
  });

  it("이메일 형식이 틀리거나 비면 거부", () => {
    expect(parseSignupForm({ ...valid, email: "abc" }).ok).toBe(false);
    expect(parseSignupForm({ ...valid, email: "" }).ok).toBe(false);
    expect(parseSignupForm({ ...valid, email: undefined }).ok).toBe(false);
  });

  it("여러 항목이 틀리면 필드별 오류를 모두 돌려준다", () => {
    const result = parseSignupForm({ email: "x", password: "1", ageConfirmed: undefined, healthConsent: undefined });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["ageConfirmed", "email", "healthConsent", "password"]);
  });
});

describe("비밀번호 해시", () => {
  it("원문과 다른 해시를 만들고, 맞는 비밀번호만 통과한다", async () => {
    const hash = await hashPassword("abcd1234");
    expect(hash).not.toContain("abcd1234");
    expect(hash.startsWith("$2")).toBe(true);
    expect(await verifyPassword("abcd1234", hash)).toBe(true);
    expect(await verifyPassword("abcd1235", hash)).toBe(false);
  });

  it("같은 비밀번호도 매번 다른 해시가 나온다", async () => {
    expect(await hashPassword("abcd1234")).not.toBe(await hashPassword("abcd1234"));
  });

  it("72바이트가 넘는 비밀번호도 끝까지 구분한다 (한글 30자 = 90바이트)", async () => {
    const a = "가".repeat(29) + "나";
    const b = "가".repeat(29) + "다";
    const hash = await hashPassword(a);
    expect(await verifyPassword(a, hash)).toBe(true);
    expect(await verifyPassword(b, hash)).toBe(false);
  });
}, 30000);

describe("세션 토큰", () => {
  const original = process.env.SESSION_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = original;
  });

  it("키가 없거나 짧으면 설정 안 됨으로 본다", () => {
    delete process.env.SESSION_SECRET;
    expect(isSessionConfigured()).toBe(false);
    process.env.SESSION_SECRET = "짧은키";
    expect(isSessionConfigured()).toBe(false);
  });

  it("만든 토큰은 같은 키로 확인하면 계정 번호가 돌아온다", async () => {
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
    const token = await encryptSession({ userId: "user-1", version: 3 });
    expect(await decryptSession(token)).toEqual({ userId: "user-1", version: 3 });
  });

  it("다른 키로 서명했거나 깨진 토큰·빈 값은 거부한다", async () => {
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
    const token = await encryptSession({ userId: "user-1", version: 0 });
    process.env.SESSION_SECRET = "other-secret-other-secret-other-secret-9";
    expect(await decryptSession(token)).toBeNull();
    expect(await decryptSession("abc.def.ghi")).toBeNull();
    expect(await decryptSession(undefined)).toBeNull();
  });

  it("토큰 안에는 이메일 같은 개인 정보가 없다", async () => {
    process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
    const token = await encryptSession({ userId: "user-1", version: 0 });
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(Object.keys(payload).sort()).toEqual(["exp", "iat", "userId", "v"]);
  });
});

describe("가입 저장", () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    pg = new PGlite();
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
    await applyMigrations({ exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] }, dir);
    db = drizzle(pg);
  }, 60000);

  function input(email = "a@example.com") {
    const parsed = parseSignupForm({ ...valid, email });
    if (!parsed.ok) throw new Error("테스트 입력이 올바르지 않음");
    return parsed.data;
  }

  it("계정을 만들고 비밀번호는 해시로만 저장한다", async () => {
    const result = await createUser(db, input("save@example.com"));
    expect(result.status).toBe("created");
    const [row] = await db.select().from(users);
    expect(row.email).toBe("save@example.com");
    expect(row.passwordHash).not.toContain("abcd1234");
    expect(await verifyPassword("abcd1234", row.passwordHash)).toBe(true);
    expect(row.ageConfirmed).toBe(true);
    expect(row.healthConsentAt).toBeInstanceOf(Date);
    expect(row.level).toBe("hobby");
  });

  it("이미 가입한 이메일은 (대소문자가 달라도) 새로 만들지 않고 duplicate", async () => {
    expect((await createUser(db, input("Dup@Example.com"))).status).toBe("created");
    expect((await createUser(db, input("dup@example.com"))).status).toBe("duplicate");
    const rows = await pg.query("SELECT 1 FROM users WHERE email = 'dup@example.com'");
    expect(rows.rows).toHaveLength(1);
  });
}, 30000);
