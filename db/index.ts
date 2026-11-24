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
  // 서버리스 환경에서 연결이 넘치지 않게 연결 수를 1로, 연결 풀러와 호환되게 prepare를 끈다. 연결은 항상 암호화(SSL)한다.
  // 오래 놀고 있는 연결은 닫고(10초), 연결이 너무 오래 쓰이면 새로 만들어(5분), 끊어진 연결에 질의가 걸려 멈추는 일을 막는다.
  const client = postgres(url, {
    max: 1,
    prepare: false,
    ssl: "require",
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 300,
    // 중요: 연결 풀러(Supabase 트랜잭션 풀러)는 한 연결에 질의를 여러 개 동시에 보내는 "파이프라이닝"을 처리하지 못해 영원히 멈춘다.
    // (동시에 요청이 두 개만 와도 재현됨) 그래서 한 번에 질의 하나씩만 보낸다. 나머지는 줄을 서서 차례로 처리된다.
    max_pipeline: 1,
  });
  globalForDb.__db = drizzle(client, { schema });
  return globalForDb.__db;
}

export { schema };
