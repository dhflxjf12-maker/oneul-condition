import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// 데이터베이스 구조(db/migrations/*.sql)를 파일 이름 순서대로 한 번씩만 적용한다.
// 이미 적용한 파일은 _migrations 표에 기록해 두고 건너뛰므로, 여러 번 실행해도 안전하다.
// 서버 코드와 같은 표 정의를 쓰도록, 실제 연결은 바깥(scripts/migrate.mjs, 테스트)에서 주입한다.

/**
 * @param {{ exec: (sql: string) => Promise<unknown>, query: (sql: string) => Promise<Array<Record<string, unknown>>> }} db
 * @param {string} dir 마이그레이션 .sql 파일이 있는 폴더
 * @returns {Promise<string[]>} 이번에 새로 적용한 파일 이름들
 */
export async function applyMigrations(db, dir) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const done = new Set((await db.query("SELECT name FROM _migrations")).map((row) => String(row.name)));

  const files = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const applied = [];
  for (const name of files) {
    if (done.has(name)) continue;
    const body = await readFile(path.join(dir, name), "utf8");
    const literal = name.replaceAll("'", "''");
    // 여러 문장을 한 번에 보내면 한 묶음(트랜잭션)으로 실행되어, 중간에 실패하면 전부 취소된다.
    await db.exec(`${body}\nINSERT INTO _migrations (name) VALUES ('${literal}');`);
    applied.push(name);
  }
  return applied;
}
