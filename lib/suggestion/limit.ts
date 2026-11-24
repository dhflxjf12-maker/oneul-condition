import { getDb, isDbConfigured } from "../../db";
import { MAX_AI_CALLS_PER_DAY } from "../domain/constants";
import { tryConsumeInDb } from "./db-counter";
import { aiCallCounter } from "./rate-limit";

// Design Ref: §4.2 4단계 — 하루 한도 확인. 데이터베이스가 설정되어 있으면 거기에 세고,
// 없거나 연결이 실패하면 서버 메모리 방식으로 대신한다. (한도 확인 때문에 제안이 막히지는 않는다.)

/** 주어진 시간 안에 끝나지 않으면 오류로 처리한다. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("데이터베이스 응답 시간 초과")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** 데이터베이스 한도 확인에 기다릴 최대 시간. 넘으면 메모리 방식으로 대신한다. (제안이 5초 안에 나오도록 한도 확인이 오래 붙잡지 못하게) */
const DB_LIMIT_TIMEOUT_MS = 1500;

/** 한도 안이면 횟수를 올리고 true, 넘었으면 false. (AI 호출뿐 아니라 로그인·가입 시도 한도에도 같은 방식으로 쓴다) */
export async function consumeDailyLimit(subjectKey: string, limit: number = MAX_AI_CALLS_PER_DAY): Promise<boolean> {
  if (isDbConfigured()) {
    try {
      return await withTimeout(tryConsumeInDb(getDb(), subjectKey, limit), DB_LIMIT_TIMEOUT_MS);
    } catch {
      // 데이터베이스 오류: 아래 메모리 방식으로 대신한다.
    }
  }
  return aiCallCounter.tryConsume(subjectKey, limit);
}

/** 이전 이름 (AI 호출 한도) */
export const consumeAiCall = consumeDailyLimit;
