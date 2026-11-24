import { hashForKey } from "./auth/email-hash";

// 요청을 보낸 곳(IP)을 한도 계산용 키로 만든다. IP 원문은 저장하지 않고 해시한 값만 쓴다.
// 주의: Vercel은 X-Forwarded-For를 직접 덮어써서 위조를 막아 준다. Vercel이 아닌 곳에서 직접 운영하면 신뢰할 수 있는 프록시 헤더만 쓰도록 바꿔야 한다.

/** 요청 헤더에서 접속자 IP를 꺼낸다. 알 수 없으면 "unknown". */
export function clientIpFrom(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

/** 한도 계산에 쓸 IP 해시 키 */
export function ipKeyFrom(headers: Headers): string {
  return hashForKey(clientIpFrom(headers));
}
