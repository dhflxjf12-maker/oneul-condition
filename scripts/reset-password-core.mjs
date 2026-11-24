import { createHash, createHmac, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

// Design Ref: §4.5 관리자 비밀번호 초기화 — 임시 비밀번호(16자)를 만들어 해시로 저장하고, 기존 로그인을 모두 끊는다.
// 서버 코드(lib/auth/password.ts)와 "똑같은 방식"으로 해시해야 로그인이 되므로 같은 규칙을 쓴다:
//   SHA-256(base64) → bcrypt cost 10. (tests/reset-password.test.ts 가 두 방식이 서로 호환되는지 확인한다)
// 연결은 바깥에서 주입한다: db.query(text, params) → 행 배열.

const BCRYPT_COST = 10;
/** 헷갈리는 글자(0 O 1 l I)를 뺀 글자 모음 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TEMP_PASSWORD_LENGTH = 16;

/** 무작위 임시 비밀번호를 만든다. (암호학적 난수) */
export function generateTempPassword() {
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function prehash(password) {
  return createHash("sha256").update(password, "utf8").digest("base64");
}

/** 로그인 잠금 기록에 쓰는 이메일 해시 (lib/auth/email-hash.ts 의 hashEmail 과 같은 값). 키가 없으면 null. */
function emailHashOrNull(email) {
  const secret = process.env.EMAIL_HASH_SECRET;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(email.toLowerCase(), "utf8").digest("hex");
}

/**
 * 가입 이메일의 비밀번호를 임시 비밀번호로 바꾼다.
 * - 기존 로그인(세션)을 모두 무효로 만든다. (session_version + 1)
 * - 이 이메일의 로그인 잠금·실패 횟수를 풀어 준다.
 * @param {{ query: (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>> }} db
 * @param {string} rawEmail 가입 이메일
 * @returns {Promise<{ ok: true, tempPassword: string, lockCleared: boolean } | { ok: false, reason: "invalid-email" | "not-found" }>}
 */
export async function resetPassword(db, rawEmail) {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!email.includes("@")) return { ok: false, reason: "invalid-email" };

  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(prehash(tempPassword), BCRYPT_COST);
  const updated = await db.query(
    "UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE email = $2 RETURNING id",
    [hash, email],
  );
  if (updated.length === 0) return { ok: false, reason: "not-found" };

  const emailHash = emailHashOrNull(email);
  if (emailHash) await db.query("DELETE FROM login_attempts WHERE email_hash = $1", [emailHash]);
  return { ok: true, tempPassword, lockCleared: emailHash !== null };
}
