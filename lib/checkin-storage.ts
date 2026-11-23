import { SORENESS_MAX_POINT, SORENESS_MIN_POINT, SORENESS_PARTS } from "./domain/constants";
import { createEmptySoreness } from "./domain/score";
import type { ExerciseLevel, Rating, Soreness, SorenessPoint } from "./domain/types";

// Design Ref: §2.2 — 체크인 임시 보관·운동 수준 기억(비로그인)은 브라우저의 localStorage에만 두고 서버로 보내지 않는다.
// 저장소는 인자로 받아서(기본: 브라우저 localStorage) 테스트에서 가짜 저장소로 확인할 수 있다.

const DRAFT_KEY = "checkin-draft-v1";
const LEVEL_KEY = "checkin-level-v1";

/** 5개 필수 항목의 임시 입력값 (아직 안 고른 항목은 없음) */
export type DraftItems = {
  sleepBand?: Rating;
  sleepQuality?: Rating;
  fatigue?: Rating;
  mood?: Rating;
  yesterdayLoad?: Rating;
};

export type SorenessModeValue = "none" | "some";

/** 임시 보관하는 체크인 입력 전체 */
export type SavedDraft = {
  items: DraftItems;
  sorenessMode: SorenessModeValue;
  soreness: Soreness;
};

type Stored = { date: string; draft: SavedDraft };

/** 브라우저 localStorage (없거나 막혀 있으면 null) */
export function getBrowserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 오늘 날짜(기기 시간 기준) "YYYY-MM-DD". 아침 체크인은 하루 단위라 날짜가 바뀌면 어제 입력값은 쓰지 않는다. */
export function todayKey(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isRating(value: unknown): value is Rating {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isSorenessPoint(value: unknown): value is SorenessPoint {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= SORENESS_MIN_POINT &&
    value <= SORENESS_MAX_POINT
  );
}

/** 저장된 값이 깨졌거나 조작되었을 수 있으니, 모양을 하나씩 검사해서 올바른 값만 살린다. */
function parseDraft(raw: unknown): SavedDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const itemsRaw = typeof record.items === "object" && record.items !== null ? (record.items as Record<string, unknown>) : {};
  const items: DraftItems = {};
  for (const key of ["sleepBand", "sleepQuality", "fatigue", "mood", "yesterdayLoad"] as const) {
    const value = itemsRaw[key];
    if (isRating(value)) items[key] = value;
  }

  const soreness = createEmptySoreness();
  const sorenessRaw =
    typeof record.soreness === "object" && record.soreness !== null ? (record.soreness as Record<string, unknown>) : {};
  for (const part of SORENESS_PARTS) {
    const value = sorenessRaw[part];
    if (isSorenessPoint(value)) soreness[part] = value;
  }

  const sorenessMode: SorenessModeValue = record.sorenessMode === "some" ? "some" : "none";
  return { items, sorenessMode, soreness };
}

/** 오늘 날짜로 보관된 입력값을 읽는다. 없거나 다른 날 것이거나 깨졌으면 null. */
export function loadDraft(storage: Storage | null, today: string = todayKey()): SavedDraft | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(DRAFT_KEY);
    if (!text) return null;
    const stored = JSON.parse(text) as Partial<Stored> | null;
    if (!stored || stored.date !== today) return null;
    return parseDraft(stored.draft);
  } catch {
    return null;
  }
}

/** 입력값을 오늘 날짜와 함께 보관한다. (저장 공간이 꽉 찼거나 막혀 있어도 앱은 그대로 동작한다.) */
export function saveDraft(storage: Storage | null, draft: SavedDraft, today: string = todayKey()): void {
  if (!storage) return;
  try {
    const stored: Stored = { date: today, draft };
    storage.setItem(DRAFT_KEY, JSON.stringify(stored));
  } catch {
    // 보관은 편의 기능이라 실패해도 무시한다.
  }
}

/** 마지막으로 고른 운동 수준을 읽는다. 없거나 알 수 없는 값이면 null. */
export function loadLevel(storage: Storage | null): ExerciseLevel | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(LEVEL_KEY);
    return value === "hobby" || value === "athlete" ? value : null;
  } catch {
    return null;
  }
}

/** 운동 수준을 기억해 둔다. */
export function saveLevel(storage: Storage | null, level: ExerciseLevel): void {
  if (!storage) return;
  try {
    storage.setItem(LEVEL_KEY, level);
  } catch {
    // 무시
  }
}
