import type { NextConfig } from "next";

// 보안 헤더 (공개 전 보안 점검 M2): 다른 사이트가 이 앱을 투명한 화면(iframe)으로 덮어 클릭을 유도하는 것(클릭재킹)을 막고,
// 브라우저가 파일 종류를 멋대로 추측하거나 주소 전체를 다른 사이트에 알려 주는 것을 막는다.
// 글자(스크립트) 실행 범위를 제한하는 전체 CSP(script-src)는 nonce 방식이 필요해서 배포 후 단계적으로 적용한다.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
