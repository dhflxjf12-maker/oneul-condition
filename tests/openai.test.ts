import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiCaller, SUGGESTION_MODEL } from "../lib/suggestion/openai";

// OpenAI 호출부: 키 없음 처리, 요청 모양, 응답 꺼내기, 실패 처리를 가짜 fetch로 확인한다. (실제 외부 호출 없음)

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ARGS = { system: "시스템 지침", user: "체크인 값", signal: new AbortController().signal };

describe("createOpenAiCaller", () => {
  it("키가 없으면 null (항상 기본 문구)", () => {
    expect(createOpenAiCaller(undefined)).toBeNull();
    expect(createOpenAiCaller("")).toBeNull();
  });

  it("gpt-4o-mini로 chat/completions에 JSON 형식을 요청하고 키는 헤더로만 보낸다", async () => {
    const fn = stubFetch(Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const text = await createOpenAiCaller("test-key")!(ARGS);
    expect(text).toBe('{"ok":true}');

    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(SUGGESTION_MODEL);
    expect(SUGGESTION_MODEL).toBe("gpt-4o-mini");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages).toEqual([
      { role: "system", content: "시스템 지침" },
      { role: "user", content: "체크인 값" },
    ]);
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("모델과 주소를 바꿀 수 있다", async () => {
    const fn = stubFetch(Response.json({ choices: [{ message: { content: "x" } }] }));
    await createOpenAiCaller("k", { model: "other-model", baseUrl: "http://localhost:9/v1/" })!(ARGS);
    const [url, init] = fn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:9/v1/chat/completions");
    expect(JSON.parse(init.body as string).model).toBe("other-model");
  });

  it("HTTP 오류면 예외를 던진다 (호출한 쪽이 기본 문구로 대체)", async () => {
    stubFetch(new Response("boom", { status: 500 }));
    await expect(createOpenAiCaller("k")!(ARGS)).rejects.toThrow("HTTP 500");
  });

  it("응답에 내용이 없으면 빈 문자열", async () => {
    stubFetch(Response.json({ choices: [] }));
    expect(await createOpenAiCaller("k")!(ARGS)).toBe("");
  });
});
