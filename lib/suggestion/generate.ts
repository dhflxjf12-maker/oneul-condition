import { AI_SERVER_TIMEOUT_MS } from "../domain/constants";
import { getFallbackSuggestion } from "../domain/fallback";
import { decideIntensity } from "../domain/intensity";
import type { Intensity, Suggestion, SuggestionSource } from "../domain/types";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt";
import type { SuggestionRequest } from "./request";
import { validateSuggestion } from "./validate";

// Design Ref: §4.2 처리 순서 2~7 — 점수·강도 재계산 → (6부위 모두 높으면 AI 없이 휴식 안내) → 한도 → AI(4초) → 검사 → 통과하면 AI, 아니면 기본 문구.
// Plan SC: AI가 실패·지연·한도 초과·규칙 위반이어도 항상 규칙을 지키는 제안이 나온다. (작업 9번)

export type ModelCaller = (args: { system: string; user: string; signal: AbortSignal }) => Promise<string>;

export type GenerateDeps = {
  /** AI 호출 함수. 없으면(키 미설정 등) 항상 기본 문구. */
  callModel: ModelCaller | null;
  /** 한도 안이면 true (횟수를 함께 올린다) */
  tryConsume: () => boolean | Promise<boolean>;
  timeoutMs?: number;
};

export type SuggestionResponse = {
  score: number;
  intensity: Intensity;
  source: SuggestionSource;
  suggestion: Suggestion;
};

/** AI 글에서 JSON 객체를 꺼낸다. (앞뒤에 설명이나 코드 블록이 붙어도 처리) */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** 제안 한 건을 만든다. 어떤 경우에도 예외를 던지지 않고 기본 문구로 대신한다. */
export async function generateSuggestion(request: SuggestionRequest, deps: GenerateDeps): Promise<SuggestionResponse> {
  // 화면이 보낸 점수·강도는 믿지 않고 서버가 다시 계산한다.
  const decided = decideIntensity(request.checkin);
  const fallback = (): SuggestionResponse => ({
    score: decided.score,
    intensity: decided.intensity,
    source: "fallback",
    suggestion: getFallbackSuggestion(request.level, decided.intensity, decided.restParts),
  });

  // 6부위 모두 높으면 AI를 쓰지 않고 기본 휴식 안내 (한도도 쓰지 않는다)
  if (decided.restLocked || !deps.callModel) return fallback();

  // 한도 확인
  if (!(await deps.tryConsume())) return fallback();

  const controller = new AbortController();
  const timeoutMs = deps.timeoutMs ?? AI_SERVER_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("AI 응답 시간 초과"));
      }, timeoutMs);
    });
    const text = await Promise.race([
      deps.callModel({
        system: SYSTEM_PROMPT,
        user: buildUserPrompt({
          level: request.level,
          intensity: decided.intensity,
          input: request.checkin,
          restParts: decided.restParts,
        }),
        signal: controller.signal,
      }),
      timeout,
    ]);

    const checked = validateSuggestion(extractJson(text), {
      level: request.level,
      intensity: decided.intensity,
      restParts: decided.restParts,
    });
    if (!checked) return fallback();
    return { score: decided.score, intensity: decided.intensity, source: "ai", suggestion: checked };
  } catch {
    // 실패·지연·잘못된 키 등 모두 기본 문구로 대체 (오류 내용은 사용자에게 보여 주지 않는다)
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
