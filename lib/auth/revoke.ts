import { eq, sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { users } from "../../db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

/**
 * 이 계정의 모든 로그인(세션)을 즉시 무효로 만든다. (로그아웃, 관리자 비밀번호 초기화 때 호출)
 * 관리자 비밀번호 초기화 스크립트(작업 22)도 비밀번호를 바꾼 뒤 반드시 이 함수와 같은 일(session_version + 1)을 해야 한다.
 */
export async function revokeSessions(db: AnyPgDb, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId));
}
