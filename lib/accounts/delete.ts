import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { loginAttempts, users } from "../../db/schema";

// Design Ref: §3.2·§4.1 deleteAccount — 계정을 삭제하면 체크인 기록·체감 응답(표의 연결 규칙으로 함께 삭제)과
// 그 이메일의 로그인 시도 기록이 함께 삭제된다. (PRD: 계정과 체크인 기록을 함께 지운다)
// ai_calls는 로그인 계정이 아니라 기기·IP 기준으로 세므로 계정 삭제와 무관하고, 7일이 지나면 저절로 지워진다.

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 서버(postgres-js)와 테스트(pglite) 모두 받기 위해
type AnyPgDb = PgDatabase<any, any>;

/**
 * 내 계정과 기록을 모두 지운다. 되돌릴 수 없다.
 * @param emailHash 이 계정 이메일의 해시(로그인 시도 기록 삭제용). 알 수 없으면 null.
 * @returns 지운 계정이 있었으면 true
 */
export async function deleteAccountRecord(db: AnyPgDb, input: { userId: string; emailHash: string | null }): Promise<boolean> {
  return db.transaction(async (tx) => {
    if (input.emailHash) {
      await tx.delete(loginAttempts).where(eq(loginAttempts.emailHash, input.emailHash));
    }
    // checkins·survey_responses는 users를 참조하며 ON DELETE CASCADE라서 함께 지워진다.
    const deleted = await tx.delete(users).where(eq(users.id, input.userId)).returning({ id: users.id });
    return deleted.length > 0;
  });
}
