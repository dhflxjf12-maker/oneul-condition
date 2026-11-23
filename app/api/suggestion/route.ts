import { cookies } from "next/headers";
import { createAnthropicCaller } from "@/lib/suggestion/anthropic";
import { generateSuggestion } from "@/lib/suggestion/generate";
import { aiCallCounter, MAX_AI_CALLS_PER_DAY_PER_IP } from "@/lib/suggestion/rate-limit";
import { parseSuggestionRequest } from "@/lib/suggestion/request";

// Design Ref: §4.2 — POST /api/suggestion: 체크인 값 + 운동 수준만 받아 제안을 만든다. 로그인은 필요 없다.
// 한도·AI 실패·규칙 위반이어도 200으로 기본 문구를 준다. 입력 형식이 틀리면 400.

const DEVICE_COOKIE = "device-id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  const parsed = parseSuggestionRequest(body);
  if (!parsed) return Response.json({ code: "INVALID_INPUT" }, { status: 400 });

  // 비로그인 사용자는 익명 기기 번호(쿠키)로 하루 20회를 센다. 쿠키를 지워 우회하는 경우를 막으려고 IP 보조 상한도 둔다.
  const cookieStore = await cookies();
  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    cookieStore.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const result = await generateSuggestion(parsed, {
      callModel: createAnthropicCaller(process.env.ANTHROPIC_API_KEY),
      tryConsume: () =>
        aiCallCounter.tryConsume(`device:${deviceId}`) &&
        aiCallCounter.tryConsume(`ip:${ip}`, MAX_AI_CALLS_PER_DAY_PER_IP),
    });
    return Response.json(result);
  } catch {
    // 예상 못한 오류: 화면이 기본 문구로 대체한다.
    return Response.json({ code: "SERVER_ERROR" }, { status: 500 });
  }
}
