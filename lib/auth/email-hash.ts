import { createHmac } from "node:crypto";

// Design Ref: §3.1 login_attempts — 이메일을 소문자로 바꾼 뒤 비밀 키(EMAIL_HASH_SECRET)를 섞어 해시(HMAC)한 값만 저장한다.
// 이메일 원문은 저장하지 않고, 흔한 이메일 목록과 대조해 알아내지 못하게 한다.

const MIN_SECRET_LENGTH = 32;

/** EMAIL_HASH_SECRET 이 올바르게 설정되어 있는지 */
export function isEmailHashConfigured(): boolean {
  return (process.env.EMAIL_HASH_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH;
}

/** 로그인 시도 기록에 쓸 이메일 해시 (이메일은 이미 소문자·공백 제거된 값이어야 한다) */
export function hashEmail(email: string): string {
  const secret = process.env.EMAIL_HASH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`EMAIL_HASH_SECRET 이 없거나 ${MIN_SECRET_LENGTH}자보다 짧습니다. .env 에 긴 무작위 문자열을 넣어 주세요.`);
  }
  return createHmac("sha256", secret).update(email.toLowerCase(), "utf8").digest("hex");
}
