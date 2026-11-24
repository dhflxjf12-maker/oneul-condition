import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../db";
import { users } from "../../db/schema";
import { getSessionClaims } from "./session";

// 세션 쿠키가 유효해도 (1) 계정이 이미 삭제되었거나 (2) 로그아웃·비밀번호 초기화로 세션이 취소되었을 수 있다.
// 그래서 로그인 상태를 판단하거나 내 기록에 접근할 때는 항상 DB의 계정·세션 번호와 맞는지까지 확인한다.

export type CurrentUser = { id: string; email: string };

/** 지금 로그인한 계정 (로그인하지 않았거나, 계정이 없거나, 세션이 취소되었거나, 확인하지 못하면 null) */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const claims = await getSessionClaims();
  if (!claims || !isDbConfigured()) return null;
  try {
    const [user] = await getDb()
      .select({ id: users.id, email: users.email, sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, claims.userId));
    if (!user || user.sessionVersion !== claims.version) return null;
    return { id: user.id, email: user.email };
  } catch {
    return null;
  }
}
