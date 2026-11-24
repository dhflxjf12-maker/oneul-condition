import { cookies } from "next/headers";
import { MAX_AI_CALLS_PER_DAY_GLOBAL } from "@/lib/domain/constants";
import { ipKeyFrom } from "@/lib/request-ip";
import { generateSuggestion } from "@/lib/suggestion/generate";
import { consumeDailyLimit } from "@/lib/suggestion/limit";
import { createOpenAiCaller } from "@/lib/suggestion/openai";
import { MAX_AI_CALLS_PER_DAY_PER_IP } from "@/lib/suggestion/rate-limit";
import { parseSuggestionRequest } from "@/lib/suggestion/request";

// Design Ref: §4.2 — POST /api/suggestion: 체크인 값 + 운동 수준만 받아 제안을 만든다. 로그인은 필요 없다.
// 한도·AI 실패·규칙 위반이어도 200으로 기본 문구를 준다. 입력 형식이 틀리면 400.
// 보안(공개 전 점검 H1): 다른 사이트에서 몰래 부르는 요청과 JSON이 아닌 요청을 거부하고, 서비스 전체 하루 상한을 둔다.

const DEVICE_COOKIE = "device-id";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // 다른 사이트(cross-site)나 다른 출처에서 온 브라우저 요청은 거부한다. 같은 사이트에서 온 요청이거나
  // 브라우저가 아닌 클라이언트(헤더 없음)만 통과한다. (브라우저가 보내는 Sec-Fetch-Site는 사이트 코드가 위조할 수 없다)
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  }
  // JSON만 받는다. (text/plain 같은 "단순 요청"으로 다른 사이트가 몰래 보내는 길을 막는다)
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ code: "INVALID_INPUT" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ code: "INVALID_INPUT" }, { status: 400 });
  }

  const parsed = parseSuggestionRequest(body);
  if (!parsed) return Response.json({ code: "INVALID_INPUT" }, { status: 400 });

  // 비로그인 사용자는 익명 기기 번호(쿠키)로 하루 20회를 센다. 쿠키를 지워 우회하는 경우를 막으려고 IP 보조 상한도 둔다.
  // 쿠키 값이 정해진 형식(UUID)이 아니면 새로 만든다. (임의의 긴 문자열이 DB 키가 되는 것을 막음)
  const cookieStore = await cookies();
  let deviceId = cookieStore.get(DEVICE_COOKIE)?.value;
  if (!deviceId || !UUID_PATTERN.test(deviceId)) {
    deviceId = crypto.randomUUID();
    cookieStore.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: ONE_YEAR_SECONDS,
      path: "/",
    });
  }
  // IP는 원문이 아니라 해시로만 센다. (DB에 IP 원문이 남지 않게)
  const ipKey = ipKeyFrom(request.headers);

  try {
    const result = await generateSuggestion(parsed, {
      callModel: createOpenAiCaller(process.env.OPENAI_API_KEY, { model: process.env.OPENAI_MODEL, baseUrl: process.env.OPENAI_BASE_URL }),
      // 순서: IP 한도 → 기기 한도 → 서비스 전체 한도. 하나라도 넘으면 AI를 부르지 않고 기본 문구를 준다.
      tryConsume: async () =>
        (await consumeDailyLimit(`ip:${ipKey}`, MAX_AI_CALLS_PER_DAY_PER_IP)) &&
        (await consumeDailyLimit(`device:${deviceId}`)) &&
        (await consumeDailyLimit("global", MAX_AI_CALLS_PER_DAY_GLOBAL)),
    });
    return Response.json(result);
  } catch {
    // 예상 못한 오류: 화면이 기본 문구로 대체한다.
    return Response.json({ code: "SERVER_ERROR" }, { status: 500 });
  }
}
