import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { applyMigrations } from "../db/migrate.mjs";

// 사용: npm run db:migrate  (.env 의 DATABASE_URL 로 연결해 데이터베이스 구조를 최신으로 만든다)
// 연결 주소 값은 화면에 출력하지 않는다.

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다. .env 에 DATABASE_URL 값을 넣은 뒤 다시 실행해 주세요.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", max_pipeline: 1, onnotice: () => {} });
try {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
  const applied = await applyMigrations(
    { exec: (text) => sql.unsafe(text), query: (text) => sql.unsafe(text) },
    dir,
  );
  console.log(applied.length > 0 ? `적용 완료: ${applied.join(", ")}` : "이미 최신 상태입니다.");
} catch (error) {
  console.error("마이그레이션 실패:", error instanceof Error ? error.message : "알 수 없는 오류");
  process.exitCode = 1;
} finally {
  await sql.end();
}
