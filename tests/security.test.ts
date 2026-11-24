import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/migrate.mjs";
import { users } from "../db/schema";
import { hashForKey } from "../lib/auth/email-hash";
import { attemptLogin } from "../lib/auth/login";
import { revokeSessions } from "../lib/auth/revoke";
import { createUser } from "../lib/auth/signup";
import { parseSignupForm } from "../lib/auth/validation";
import { clientIpFrom, ipKeyFrom } from "../lib/request-ip";
import { tryConsumeInDb } from "../lib/suggestion/db-counter";

let pg: PGlite;
let db: ReturnType<typeof drizzle>;
const original = process.env.EMAIL_HASH_SECRET;

beforeAll(async () => {
  pg = new PGlite();
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  await applyMigrations(
    { exec: (sql) => pg.exec(sql), query: async (sql) => (await pg.query(sql)).rows as Record<string, unknown>[] },
    dir,
  );
  db = drizzle(pg);
}, 60000);

afterEach(() => {
  if (original === undefined) delete process.env.EMAIL_HASH_SECRET;
  else process.env.EMAIL_HASH_SECRET = original;
});

describe("세션 취소 (로그아웃·비밀번호 초기화)", () => {
  it("새 계정의 세션 번호는 0이고, 취소하면 1씩 올라간다", async () => {
    const parsed = parseSignupForm({ email: "s@example.com", password: "abcd1234", ageConfirmed: "on", healthConsent: "on" });
    if (!parsed.ok) throw new Error("준비 실패");
    const created = await createUser(db, parsed.data);
    if (created.status !== "created") throw new Error("준비 실패");
    expect(created.sessionVersion).toBe(0);

    await revokeSessions(db, created.userId);
    await revokeSessions(db, created.userId);
    const [row] = await db.select().from(users).where(eq(users.id, created.userId));
    expect(row.sessionVersion).toBe(2);
  });

  it("로그인에 성공하면 그 시점의 세션 번호를 돌려준다 (취소 뒤 새로 로그인하면 새 번호)", async () => {
    process.env.EMAIL_HASH_SECRET = "email-hash-secret-email-hash-secret-12";
    const [row] = await db.select().from(users).where(eq(users.email, "s@example.com"));
    const result = await attemptLogin(db, { email: "s@example.com", emailHash: hashForKey("s@example.com"), password: "abcd1234" });
    expect(result).toEqual({ status: "success", userId: row.id, sessionVersion: 2 });
  });

  it("없는 계정을 취소해도 오류 없이 지나간다", async () => {
    await expect(revokeSessions(db, "00000000-0000-0000-0000-000000000000")).resolves.toBeUndefined();
  });
});

describe("요청 IP 해시", () => {
  it("첫 번째 X-Forwarded-For 값을 쓰고, 없으면 x-real-ip, 그것도 없으면 unknown", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIpFrom(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });

  it("해시에는 IP 원문이 없고, 같은 IP는 같은 키, 다른 IP는 다른 키다", () => {
    const a = ipKeyFrom(new Headers({ "x-forwarded-for": "1.2.3.4" }));
    expect(a).not.toContain("1.2.3.4");
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).toBe(ipKeyFrom(new Headers({ "x-forwarded-for": "1.2.3.4" })));
    expect(a).not.toBe(ipKeyFrom(new Headers({ "x-forwarded-for": "1.2.3.5" })));
  });

  it("비밀 키가 있을 때와 없을 때 모두 동작하고, 키가 다르면 해시도 다르다", () => {
    delete process.env.EMAIL_HASH_SECRET;
    const plain = hashForKey("1.2.3.4");
    process.env.EMAIL_HASH_SECRET = "email-hash-secret-email-hash-secret-12";
    const keyed = hashForKey("1.2.3.4");
    expect(keyed).not.toBe(plain);
    expect(keyed).toHaveLength(32);
  });
});

describe("IP·가입 한도 (같은 횟수 세기 방식)", () => {
  const now = new Date("2026-11-24T10:00:00+09:00");

  it("가입은 IP당 10번까지, 로그인은 60번까지 허용하고 넘으면 거부한다", async () => {
    for (let i = 0; i < 10; i++) expect(await tryConsumeInDb(db, "signup:ipA", 10, now)).toBe(true);
    expect(await tryConsumeInDb(db, "signup:ipA", 10, now)).toBe(false);
    expect(await tryConsumeInDb(db, "signup:ipB", 10, now)).toBe(true);
    for (let i = 0; i < 60; i++) await tryConsumeInDb(db, "login:ipA", 60, now);
    expect(await tryConsumeInDb(db, "login:ipA", 60, now)).toBe(false);
  });

  it("서비스 전체 상한은 모든 호출이 같은 키를 공유해서 센다", async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () => tryConsumeInDb(db, "global", 20, now)));
    expect(results.filter(Boolean)).toHaveLength(20);
  });
});
