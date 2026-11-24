import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

// Design Ref: §2.3 — 비밀번호는 원문으로 저장하지 않고 bcrypt 해시로만 저장하고, 비교는 서버에서 한다.
// bcrypt는 72바이트까지만 읽으므로(한글은 글자당 3바이트), 먼저 SHA-256으로 고정 길이(44자)로 줄인 뒤 bcrypt에 넣는다.
// 관리자 비밀번호 초기화 스크립트(작업 22)도 반드시 이 함수들을 같이 써야 한다.

const BCRYPT_COST = 10;

function prehash(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("base64");
}

/** 비밀번호를 해시로 바꾼다. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(prehash(password), BCRYPT_COST);
}

/** 입력한 비밀번호가 저장된 해시와 맞는지 확인한다. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(prehash(password), hash);
}
