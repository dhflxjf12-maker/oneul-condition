import type { ModelCaller } from "./generate";

// Design Ref: §2.3 — 제안 문장은 외부 AI(OpenAI)의 Chat Completions API로 만든다. 별도 라이브러리 없이 fetch로 부른다.
// 모델은 빠르고 저렴한 gpt-4o-mini. 바꾸려면 환경 변수 OPENAI_MODEL 또는 아래 한 줄만 수정한다.
export const SUGGESTION_MODEL = "gpt-4o-mini";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

/**
 * 키가 있을 때만 AI 호출 함수를 만든다. 키가 없으면 null (항상 기본 문구).
 * 키는 서버 환경 변수 OPENAI_API_KEY에서만 읽고, 화면·로그에 내보내지 않는다.
 * @param baseUrl 테스트용으로만 바꾼다 (OPENAI_BASE_URL). 기본은 OpenAI 공식 주소.
 */
export function createOpenAiCaller(
  apiKey: string | undefined,
  options: { model?: string; baseUrl?: string } = {},
): ModelCaller | null {
  if (!apiKey) return null;
  const model = options.model || SUGGESTION_MODEL;
  const baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  return async ({ system, user, signal }) => {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        // 제안은 JSON 하나로만 받는다. (형식이 어긋나면 기존처럼 검사에서 걸러져 기본 문구로 바뀐다)
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`AI 호출 실패 (HTTP ${response.status})`);
    const data = (await response.json()) as ChatCompletionResponse;
    return data.choices?.[0]?.message?.content ?? "";
  };
}
