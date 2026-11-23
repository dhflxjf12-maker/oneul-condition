import { describe, expect, it } from "vitest";
import { SUGGESTION_MINUTES_RANGE } from "../lib/domain/constants";
import { createEmptySoreness } from "../lib/domain/score";
import type { CheckinInput } from "../lib/domain/types";
import { extractJson, generateSuggestion, type ModelCaller } from "../lib/suggestion/generate";
import { buildUserPrompt, SYSTEM_PROMPT } from "../lib/suggestion/prompt";
import { createMemoryCounter, kstDateKey } from "../lib/suggestion/rate-limit";
import { parseSuggestionRequest } from "../lib/suggestion/request";
import { validateSuggestion } from "../lib/suggestion/validate";

// 점수 71·보통, 하체 4점 (DESIGN §4.2 예시와 같은 입력)
const checkin: CheckinInput = {
  sleepBand: 4,
  sleepQuality: 4,
  fatigue: 2,
  soreness: { ...createEmptySoreness(), lower: 4 },
  mood: 4,
  yesterdayLoad: 3,
};
const request = { level: "hobby" as const, checkin };

const goodAi = {
  type: "strength",
  minutes: 40,
  targetParts: ["shoulder", "back", "arm", "chest"],
  restParts: ["lower"],
  message: "상체 위주로 40분 근력 운동을 해 보세요. 하체는 쉬어 주세요.",
};
const okCaller: ModelCaller = async () => JSON.stringify(goodAi);
const allow = () => true;

describe("요청 검사", () => {
  it("올바른 값은 통과, 범위 밖·누락은 거부", () => {
    expect(parseSuggestionRequest(request)).not.toBeNull();
    expect(parseSuggestionRequest({ ...request, level: "pro" })).toBeNull();
    expect(parseSuggestionRequest({ level: "hobby" })).toBeNull();
    expect(parseSuggestionRequest({ ...request, checkin: { ...checkin, mood: 6 } })).toBeNull();
    expect(parseSuggestionRequest({ ...request, checkin: { ...checkin, soreness: { ...checkin.soreness, back: 2.5 } } })).toBeNull();
    expect(parseSuggestionRequest(null)).toBeNull();
  });
});

describe("AI 응답 검사", () => {
  const context = { level: "hobby" as const, intensity: "moderate" as const, restParts: ["lower" as const] };

  it("규칙을 지키면 통과", () => {
    expect(validateSuggestion(goodAi, context)?.minutes).toBe(40);
  });

  it("시간이 범위 밖이면 거부 (애호가 보통 30~45분)", () => {
    expect(validateSuggestion({ ...goodAi, minutes: 29 }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, minutes: 46 }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, minutes: 30 }, context)).not.toBeNull();
    expect(validateSuggestion({ ...goodAi, minutes: 45 }, context)).not.toBeNull();
  });

  it("허용되지 않은 종류·형식은 거부", () => {
    expect(validateSuggestion({ ...goodAi, type: "yoga" }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, minutes: "40" }, context)).toBeNull();
    expect(validateSuggestion("문장", context)).toBeNull();
    expect(validateSuggestion(null, context)).toBeNull();
  });

  it("쉬어야 할 부위가 4점 이상 부위와 다르면 거부", () => {
    expect(validateSuggestion({ ...goodAi, restParts: [] }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, restParts: ["lower", "arm"] }, context)).toBeNull();
  });

  it("사용 부위가 쉬는 부위와 겹치거나 쉬는 부위가 있는데 전신이면 거부", () => {
    expect(validateSuggestion({ ...goodAi, targetParts: ["chest", "lower"] }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, targetParts: ["whole"] }, context)).toBeNull();
  });

  it("쉬는 부위가 없으면 전신 가능, 전신과 다른 부위 혼용은 거부", () => {
    const none = { level: "hobby" as const, intensity: "moderate" as const, restParts: [] };
    expect(validateSuggestion({ ...goodAi, restParts: [], targetParts: ["whole"] }, none)).not.toBeNull();
    expect(validateSuggestion({ ...goodAi, restParts: [], targetParts: ["whole", "chest"] }, none)).toBeNull();
  });

  it("진단·치료 같은 금지어가 있으면 거부", () => {
    expect(validateSuggestion({ ...goodAi, message: "디스크가 걱정되니 쉬세요" }, context)).toBeNull();
    expect(validateSuggestion({ ...goodAi, message: "치료 목적으로 운동하세요" }, context)).toBeNull();
  });

  it("너무 긴 문구는 거부", () => {
    expect(validateSuggestion({ ...goodAi, message: "가".repeat(201) }, context)).toBeNull();
  });

  it("휴식 강도에서는 짧은 회복 활동만 허용", () => {
    const rest = { level: "hobby" as const, intensity: "rest" as const, restParts: [] };
    const base = { type: "recovery", minutes: 10, targetParts: ["whole"], restParts: [], message: "가볍게 스트레칭하세요." };
    expect(validateSuggestion(base, rest)).not.toBeNull();
    expect(validateSuggestion({ ...base, minutes: 11 }, rest)).toBeNull();
    expect(validateSuggestion({ ...base, type: "cardio" }, rest)).toBeNull();
  });

  it("범위는 수준·강도 표와 같다", () => {
    for (const level of ["hobby", "athlete"] as const) {
      for (const intensity of ["light", "moderate", "high"] as const) {
        const { min, max } = SUGGESTION_MINUTES_RANGE[level][intensity];
        const ctx = { level, intensity, restParts: [] };
        const base = { type: "cardio", targetParts: ["whole"], restParts: [], message: "좋아요." };
        expect(validateSuggestion({ ...base, minutes: min }, ctx)).not.toBeNull();
        expect(validateSuggestion({ ...base, minutes: max }, ctx)).not.toBeNull();
        expect(validateSuggestion({ ...base, minutes: min - 1 }, ctx)).toBeNull();
        expect(validateSuggestion({ ...base, minutes: max + 1 }, ctx)).toBeNull();
      }
    }
  });
});

describe("제안 만들기", () => {
  it("정상 AI 응답은 source ai, 점수·강도는 서버 계산값", async () => {
    const result = await generateSuggestion(request, { callModel: okCaller, tryConsume: allow });
    expect(result.source).toBe("ai");
    expect(result.score).toBe(71); // 손계산: (2000+1125+1500+300+750+1400)/100 = 70.75 → 71
    expect(result.intensity).toBe("moderate");
    expect(result.suggestion.restParts).toEqual(["lower"]);
  });

  it("AI 글 앞뒤에 코드 블록이 붙어도 JSON을 꺼낸다", async () => {
    const wrapped: ModelCaller = async () => "```json\n" + JSON.stringify(goodAi) + "\n```";
    const result = await generateSuggestion(request, { callModel: wrapped, tryConsume: allow });
    expect(result.source).toBe("ai");
    expect(extractJson("설명 없음")).toBeNull();
  });

  it("AI 키가 없으면(callModel 없음) 기본 문구", async () => {
    const result = await generateSuggestion(request, { callModel: null, tryConsume: allow });
    expect(result.source).toBe("fallback");
    expect(result.suggestion.restParts).toEqual(["lower"]);
  });

  it("AI가 오류를 던지면(키 오류 등) 기본 문구", async () => {
    const failing: ModelCaller = async () => {
      throw new Error("401");
    };
    const result = await generateSuggestion(request, { callModel: failing, tryConsume: allow });
    expect(result.source).toBe("fallback");
  });

  it("AI가 규칙을 어긴 응답을 주면 기본 문구", async () => {
    const bad: ModelCaller = async () => JSON.stringify({ ...goodAi, targetParts: ["lower"] });
    const result = await generateSuggestion(request, { callModel: bad, tryConsume: allow });
    expect(result.source).toBe("fallback");
    expect(result.suggestion.targetParts).not.toContain("lower");
  });

  it("AI가 제한 시간보다 느리면 그 시간에 끊고 기본 문구", async () => {
    const slow: ModelCaller = ({ signal }) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(JSON.stringify(goodAi)), 1000);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("abort"));
        });
      });
    const started = Date.now();
    const result = await generateSuggestion(request, { callModel: slow, tryConsume: allow, timeoutMs: 100 });
    expect(result.source).toBe("fallback");
    expect(Date.now() - started).toBeLessThan(600);
  });

  it("한도를 넘으면 AI를 부르지 않고 기본 문구", async () => {
    let called = false;
    const spy: ModelCaller = async () => {
      called = true;
      return JSON.stringify(goodAi);
    };
    const result = await generateSuggestion(request, { callModel: spy, tryConsume: () => false });
    expect(result.source).toBe("fallback");
    expect(called).toBe(false);
  });

  it("근육통 6부위가 모두 높으면 AI도 한도도 쓰지 않고 휴식 안내", async () => {
    let called = false;
    let consumed = false;
    const spy: ModelCaller = async () => {
      called = true;
      return "{}";
    };
    const allHigh: CheckinInput = {
      ...checkin,
      soreness: { shoulder: 5, back: 4, arm: 4, chest: 5, abdomen: 4, lower: 5 },
    };
    const result = await generateSuggestion(
      { level: "hobby", checkin: allHigh },
      { callModel: spy, tryConsume: () => ((consumed = true), true) },
    );
    expect(result.source).toBe("fallback");
    expect(result.intensity).toBe("rest");
    expect(called).toBe(false);
    expect(consumed).toBe(false);
  });
});

describe("프롬프트", () => {
  it("체크인 값만 담고 금지어 규칙을 알린다", () => {
    const user = buildUserPrompt({ level: "hobby", intensity: "moderate", input: checkin, restParts: ["lower"] });
    expect(user).toContain("30~45");
    expect(user).toContain('"lower"');
    expect(SYSTEM_PROMPT).toContain("진단");
    expect(user).not.toMatch(/@|이메일/);
  });
});

describe("하루 한도", () => {
  it("20번까지 허용하고 21번째는 거부, 다른 기기는 따로 센다", () => {
    const counter = createMemoryCounter();
    const now = new Date("2026-11-23T10:00:00+09:00");
    for (let i = 0; i < 20; i++) expect(counter.tryConsume("device:a", 20, now)).toBe(true);
    expect(counter.tryConsume("device:a", 20, now)).toBe(false);
    expect(counter.tryConsume("device:b", 20, now)).toBe(true);
  });

  it("한국 시간 날짜가 바뀌면 다시 센다", () => {
    const counter = createMemoryCounter();
    const day1 = new Date("2026-11-23T23:50:00+09:00");
    const day2 = new Date("2026-11-24T00:10:00+09:00");
    for (let i = 0; i < 20; i++) counter.tryConsume("device:a", 20, day1);
    expect(counter.tryConsume("device:a", 20, day1)).toBe(false);
    expect(counter.tryConsume("device:a", 20, day2)).toBe(true);
    expect(kstDateKey(day1)).toBe("2026-11-23");
    expect(kstDateKey(day2)).toBe("2026-11-24");
  });
});
