import { jwtVerify, SignJWT } from "jose";
import { SESSION_DAYS } from "../domain/constants";

// Design Ref: §2.3·§7 — 세션 토큰(jose, HS256) 만들기·확인. 쿠키를 다루지 않는 순수 부분이라 테스트할 수 있다.
// 토큰에는 계정 번호만 넣고 이메일 등 개인 정보는 넣지 않는다.

/** 서명 키 최소 길이 (짧으면 추측당하기 쉽다) */
const MIN_SECRET_LENGTH = 32;

/** SESSION_SECRET 이 올바르게 설정되어 있는지 */
export function isSessionConfigured(): boolean {
  return (process.env.SESSION_SECRET?.length ?? 0) >= MIN_SECRET_LENGTH;
}

function getKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET 이 없거나 ${MIN_SECRET_LENGTH}자보다 짧습니다. .env 에 긴 무작위 문자열을 넣어 주세요.`);
  }
  return new TextEncoder().encode(secret);
}

/** 세션 토큰에 담는 값: 계정 번호와 세션 번호(로그아웃 때 올라가는 값). 이메일 등은 넣지 않는다. */
export type SessionClaims = { userId: string; version: number };

/** 세션 토큰을 만든다. */
export async function encryptSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ userId: claims.userId, v: claims.version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getKey());
}

/** 세션 토큰을 확인해 내용을 돌려준다. 위조·만료·키 없음이면 null. (DB의 세션 번호와 맞는지는 getCurrentUser가 확인한다) */
export async function decryptSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token || !isSessionConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId, version: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}
