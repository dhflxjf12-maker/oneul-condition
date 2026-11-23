import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Design Ref: §2.3 — 관리형 Postgres에 Drizzle로 접근한다. 연결 주소는 서버 환경 변수 DATABASE_URL에서만 읽는다.
// 이 파일은 서버 코드(서버 액션·API)에서만 불러온다. 화면(브라우저) 코드에서 불러오지 않는다.

export type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as { __db?: Db };

/** DATABASE_URL이 설정되어 있는지 */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** 데이터베이스 연결을 돌려준다. (서버가 켜져 있는 동안 하나만 만들어 재사용) */
export function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 이 설정되지 않았습니다. .env 에 값을 넣어 주세요.");
  // 서버리스 환경에서 연결이 넘치지 않게 연결 수를 1로, 연결 풀러와 호환되게 prepare를 끈다.
  const client = postgres(url, { max: 1, prepare: false });
  globalForDb.__db = drizzle(client, { schema });
  return globalForDb.__db;
}

export { schema };
