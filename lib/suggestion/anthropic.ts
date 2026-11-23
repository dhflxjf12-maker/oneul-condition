import Anthropic from "@anthropic-ai/sdk";
import type { ModelCaller } from "./generate";

// Design Ref: §2.3 — 제안 문장은 Anthropic SDK로 만든다. 모델은 빠르고 저렴한 Haiku 후보 (작업 9번에서 확정, 바꾸려면 이 한 줄만 수정).
export const SUGGESTION_MODEL = "claude-haiku-5-5";

/**
 * 키가 있을 때만 AI 호출 함수를 만든다. 키가 없으면 null (항상 기본 문구).
 * 키는 서버 환경 변수 ANTHROPIC_API_KEY에서만 읽고, 화면·로그에 내보내지 않는다.
 */
export function createAnthropicCaller(apiKey: string | undefined): ModelCaller | null {
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, maxRetries: 0 });

  return async ({ system, user, signal }) => {
    const message = await client.messages.create(
      {
        model: SUGGESTION_MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    return message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
  };
}
