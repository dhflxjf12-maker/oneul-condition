import { MAX_AI_CALLS_PER_DAY } from "../domain/constants";

// Design Ref: §4.2 4단계 — 하루 20회 한도. (PRD: 한 사용자, 비로그인은 기기 기준)
// 이 파일은 서버 메모리 방식이다. 데이터베이스(DATABASE_URL)가 설정되어 있으면 limit.ts가 db-counter.ts(ai_calls 표)를 쓰고,
// 데이터베이스가 없거나 오류일 때만 이 메모리 방식으로 대신한다.
// 한계: 메모리 방식은 서버가 여러 대로 나뉘거나 재시작되면 횟수가 초기화될 수 있다. 그래서 기기 한도 외에 IP 보조 상한도 둔다.

/** IP 하나가 하루에 쓸 수 있는 보조 상한 (쿠키를 지워 우회하는 경우를 막는 용도) */
export const MAX_AI_CALLS_PER_DAY_PER_IP = 100;

/** 한국 시간 기준 오늘 날짜 "YYYY-MM-DD" */
export function kstDateKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export type CallCounter = {
  /** 한도 안이면 횟수를 1 올리고 true, 한도를 넘었으면 올리지 않고 false */
  tryConsume: (subjectKey: string, limit?: number, now?: Date) => boolean;
};

/** 메모리 방식 횟수 세기. 날짜가 지난 기록은 쓸 때 함께 지운다. */
export function createMemoryCounter(): CallCounter {
  const counts = new Map<string, number>();

  return {
    tryConsume(subjectKey, limit = MAX_AI_CALLS_PER_DAY, now = new Date()) {
      const today = kstDateKey(now);
      for (const key of counts.keys()) {
        if (!key.endsWith(`|${today}`)) counts.delete(key);
      }
      const key = `${subjectKey}|${today}`;
      const used = counts.get(key) ?? 0;
      if (used >= limit) return false;
      counts.set(key, used + 1);
      return true;
    },
  };
}

/** 서버가 켜져 있는 동안 공유하는 횟수 저장소 */
export const aiCallCounter: CallCounter = createMemoryCounter();
