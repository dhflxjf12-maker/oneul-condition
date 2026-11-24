import "server-only";
import { eq } from "drizzle-orm";
import { getDb, isDbConfigured } from "../../db";
import { users } from "../../db/schema";
import { getSessionUserId } from "./session";

// 세션 쿠키가 유효해도 계정이 이미 삭제되었을 수 있다. (예: 다른 기기에서 삭제)
// 화면에서 "로그인 상태"를 보여 줄 때는 계정이 실제로 있는지까지 확인한다.

export type CurrentUser = { id: string; email: string };

/** 지금 로그인한 계정 (로그인하지 않았거나, 계정이 없거나, 확인하지 못하면 null) */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await getSessionUserId();
  if (!userId || !isDbConfigured()) return null;
  try {
    const [user] = await getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId));
    return user ?? null;
  } catch {
    return null;
  }
}
