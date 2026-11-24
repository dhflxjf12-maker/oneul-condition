import "server-only";
import { cookies } from "next/headers";
import { SESSION_DAYS } from "../domain/constants";
import { decryptSession, encryptSession } from "./token";

// Design Ref: §2.3·§7 — 로그인 상태는 서명된 쿠키에 담는다. HttpOnly·SameSite 설정, 30일 만료.
// 이 파일은 서버에서만 불러온다(server-only). 토큰 자체는 token.ts.

export { isSessionConfigured } from "./token";

export const SESSION_COOKIE = "session";
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

/** 로그인 쿠키를 만든다. */
export async function createSession(userId: string): Promise<void> {
  const token = await encryptSession(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });
}

/** 지금 로그인한 계정 번호 (로그인하지 않았으면 null) */
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(SESSION_COOKIE)?.value);
}

/** 로그인 쿠키를 지운다. */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
