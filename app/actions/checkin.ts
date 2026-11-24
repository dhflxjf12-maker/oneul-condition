"use server";

import { getDb, isDbConfigured } from "@/db";
import { getSessionUserId } from "@/lib/auth/session";
import {
  saveCheckinRecord,
  saveCheckinSchema,
  saveSuggestionRecord,
  saveSuggestionSchema,
} from "@/lib/checkins/save";
import type { SuggestionSource } from "@/lib/domain/types";

// Design Ref: §4.1·§4.4 — saveCheckin / saveSuggestion 서버 액션. 로그인한 본인의 기록만 쓴다(세션의 계정 번호만 사용).

export type SaveCheckinActionResult =
  | { ok: true; checkinDate: string }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "SERVER_ERROR" };

export type SaveSuggestionActionResult =
  | { ok: true; source: SuggestionSource }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "NO_CHECKIN" | "SERVER_ERROR" };

/** 지금 로그인했는지만 알려 준다. (체크인 값은 보내지 않는다 — 로그인하지 않았다면 값이 서버로 가지 않게 하려는 확인용) */
export async function getLoginStatus(): Promise<boolean> {
  return (await getSessionUserId()) !== null;
}

/** 점수 확인 직후 부른다. 오늘 기록을 만들거나 수정한다. */
export async function saveCheckin(payload: unknown): Promise<SaveCheckinActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const parsed = saveCheckinSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!isDbConfigured()) return { ok: false, code: "SERVER_ERROR" };

  try {
    const { level, checkin, durationSeconds } = parsed.data;
    const result = await saveCheckinRecord(getDb(), {
      userId,
      level,
      checkin: checkin as Parameters<typeof saveCheckinRecord>[1]["checkin"],
      durationSeconds,
    });
    return { ok: true, checkinDate: result.checkinDate };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}

/** saveCheckin이 끝난 뒤, 제안이 도착하면 부른다. */
export async function saveSuggestion(payload: unknown): Promise<SaveSuggestionActionResult> {
  const userId = await getSessionUserId();
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const parsed = saveSuggestionSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!isDbConfigured()) return { ok: false, code: "SERVER_ERROR" };

  try {
    const result = await saveSuggestionRecord(getDb(), { userId, ...parsed.data });
    if (result.status === "no_checkin") return { ok: false, code: "NO_CHECKIN" };
    return { ok: true, source: result.source };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}
