import postgres from "postgres";
import { resetPassword } from "./reset-password-core.mjs";

// 사용: npm run admin:reset-password -- 가입이메일@example.com
// .env 의 DATABASE_URL 로 연결한다. (EMAIL_HASH_SECRET 도 있으면 로그인 잠금까지 풀어 준다)
// 임시 비밀번호는 이 화면에 "한 번만" 보여 준다. 로그·채팅·메신저 기록에 남기지 말고, 가입 이메일로만 전달한다.

const email = process.argv[2];
if (!email) {
  console.error("사용법: npm run admin:reset-password -- 가입이메일@example.com");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 이 없습니다. .env 에 DATABASE_URL 값을 넣은 뒤 다시 실행해 주세요.");
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: "require", max_pipeline: 1, prepare: false, onnotice: () => {} });
try {
  const result = await resetPassword({ query: (text, params) => sql.unsafe(text, params) }, email);
  if (!result.ok) {
    console.error(
      result.reason === "invalid-email" ? "이메일 형식이 올바르지 않아요." : "가입된 이메일을 찾지 못했어요. 가입 이메일과 같은지 다시 확인해 주세요.",
    );
    process.exitCode = 1;
  } else {
    console.log("비밀번호를 초기화했어요. 이 계정의 기존 로그인은 모두 끊겼어요.");
    console.log(result.lockCleared ? "로그인 잠금도 풀었어요." : "(EMAIL_HASH_SECRET 이 없어 로그인 잠금은 풀지 못했어요. 잠겨 있다면 10분 뒤 풀려요.)");
    console.log("");
    console.log(`임시 비밀번호: ${result.tempPassword}`);
    console.log("");
    console.log("→ 가입 이메일 주소로만 전달하세요. 이 화면은 닫으면 다시 볼 수 없어요.");
  }
} catch (error) {
  console.error("초기화 실패:", error instanceof Error ? error.message : "알 수 없는 오류");
  process.exitCode = 1;
} finally {
  await sql.end();
}
