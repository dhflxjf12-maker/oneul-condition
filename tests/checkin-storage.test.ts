import { describe, expect, it } from "vitest";
import { createEmptySoreness } from "../lib/domain/score";
import { loadDraft, loadLevel, saveDraft, saveLevel, todayKey, type SavedDraft } from "../lib/checkin-storage";

// 가짜 저장소 (localStorage와 같은 방식으로 동작)
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

const sample: SavedDraft = {
  items: { sleepBand: 3, mood: 4 },
  sorenessMode: "some",
  soreness: { ...createEmptySoreness(), lower: 4 },
};

describe("체크인 임시 보관", () => {
  it("저장한 값을 같은 날 다시 읽으면 그대로 돌아온다", () => {
    const storage = fakeStorage();
    saveDraft(storage, sample, "2026-11-23");
    expect(loadDraft(storage, "2026-11-23")).toEqual(sample);
  });

  it("날짜가 바뀌면 어제 입력값은 쓰지 않는다", () => {
    const storage = fakeStorage();
    saveDraft(storage, sample, "2026-11-23");
    expect(loadDraft(storage, "2026-11-24")).toBeNull();
  });

  it("저장소가 없거나 비어 있으면 null", () => {
    expect(loadDraft(null)).toBeNull();
    expect(loadDraft(fakeStorage())).toBeNull();
  });

  it("깨진 JSON은 무시한다", () => {
    expect(loadDraft(fakeStorage({ "checkin-draft-v1": "{깨짐" }), "2026-11-23")).toBeNull();
  });

  it("범위를 벗어난 값은 버리고 올바른 값만 살린다", () => {
    const bad = {
      date: "2026-11-23",
      draft: {
        items: { sleepBand: 9, sleepQuality: 2, fatigue: "3", mood: 1.5, yesterdayLoad: 5 },
        sorenessMode: "x",
        soreness: { lower: 7, chest: 3 },
      },
    };
    const loaded = loadDraft(fakeStorage({ "checkin-draft-v1": JSON.stringify(bad) }), "2026-11-23");
    expect(loaded?.items).toEqual({ sleepQuality: 2, yesterdayLoad: 5 });
    expect(loaded?.sorenessMode).toBe("none");
    expect(loaded?.soreness).toEqual({ ...createEmptySoreness(), chest: 3 });
  });

  it("저장소가 에러를 던져도 앱이 멈추지 않는다", () => {
    const broken = {
      getItem: () => {
        throw new Error("막힘");
      },
      setItem: () => {
        throw new Error("꽉 참");
      },
    } as unknown as Storage;
    expect(() => saveDraft(broken, sample)).not.toThrow();
    expect(loadDraft(broken)).toBeNull();
    expect(() => saveLevel(broken, "athlete")).not.toThrow();
    expect(loadLevel(broken)).toBeNull();
  });
});

describe("운동 수준 기억", () => {
  it("저장한 수준을 읽는다", () => {
    const storage = fakeStorage();
    saveLevel(storage, "athlete");
    expect(loadLevel(storage)).toBe("athlete");
  });

  it("알 수 없는 값이면 null", () => {
    expect(loadLevel(fakeStorage({ "checkin-level-v1": "pro" }))).toBeNull();
    expect(loadLevel(fakeStorage())).toBeNull();
  });
});

describe("todayKey", () => {
  it("기기 날짜를 YYYY-MM-DD로 만든다", () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
