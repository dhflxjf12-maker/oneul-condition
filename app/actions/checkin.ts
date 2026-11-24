"use server";

import { getDb, isDbConfigured } from "@/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  markSuggestionViewedRecord,
  markViewedSchema,
  saveCheckinRecord,
  saveCheckinSchema,
  saveFeedbackRecord,
  saveFeedbackSchema,
  saveSuggestionRecord,
  saveSuggestionSchema,
} from "@/lib/checkins/save";
import type { SuggestionSource } from "@/lib/domain/types";
import { getDueSurvey, saveSurveyRecord, saveSurveySchema } from "@/lib/survey/weekly";

// Design Ref: §4.1·§4.4 — saveCheckin / saveSuggestion 서버 액션. 로그인한 본인의 기록만 쓴다(세션의 계정 번호만 사용).

export type SaveCheckinActionResult =
  | { ok: true; checkinDate: string }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "SERVER_ERROR" };

export type SaveSuggestionActionResult =
  | { ok: true; source: SuggestionSource }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "NO_CHECKIN" | "SERVER_ERROR" };

/** 지금 로그인했는지만 알려 준다. (체크인 값은 보내지 않는다 — 로그인하지 않았다면 값이 서버로 가지 않게 하려는 확인용) */
export async function getLoginStatus(): Promise<boolean> {
  // 쿠키가 유효해도 계정이 이미 삭제되었다면(다른 기기에서 삭제 등) 로그인하지 않은 것으로 본다.
  return (await getCurrentUser()) !== null;
}

/** 점수 확인 직후 부른다. 오늘 기록을 만들거나 수정한다. */
export async function saveCheckin(payload: unknown): Promise<SaveCheckinActionResult> {
  const userId = (await getCurrentUser())?.id;
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
  const userId = (await getCurrentUser())?.id;
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

export type SaveFeedbackActionResult =
  | { ok: true }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "NO_SUGGESTION" | "SERVER_ERROR" };

/** 👍/👎 평가를 내 오늘 기록에 저장한다. */
export async function saveFeedback(payload: unknown): Promise<SaveFeedbackActionResult> {
  const userId = (await getCurrentUser())?.id;
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const parsed = saveFeedbackSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!isDbConfigured()) return { ok: false, code: "SERVER_ERROR" };

  try {
    const result = await saveFeedbackRecord(getDb(), { userId, ...parsed.data });
    return result.status === "saved" ? { ok: true } : { ok: false, code: "NO_SUGGESTION" };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}

export type MarkViewedActionResult =
  | { ok: true }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "NO_SUGGESTION" | "SERVER_ERROR" };

/** 제안이 3초 이상 표시되었음을 기록한다. (지표 측정용 이용 기록, 실패해도 사용자에게 알리지 않는다) */
export async function markSuggestionViewed(payload: unknown): Promise<MarkViewedActionResult> {
  const userId = (await getCurrentUser())?.id;
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const parsed = markViewedSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!isDbConfigured()) return { ok: false, code: "SERVER_ERROR" };

  try {
    const result = await markSuggestionViewedRecord(getDb(), { userId, ...parsed.data });
    return result.status === "marked" ? { ok: true } : { ok: false, code: "NO_SUGGESTION" };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}

/**
 * 이번에 주 1회 체감 질문을 보여 줘야 하면 대상 주(지난주 월요일)를 돌려준다. 아니면 null.
 * 보여 주기로 한 순간 "물어봤다"고 기록하므로, 같은 주에는 다시 묻지 않는다.
 */
export async function getWeeklySurvey(): Promise<{ weekStart: string } | null> {
  const userId = (await getCurrentUser())?.id;
  if (!userId || !isDbConfigured()) return null;
  try {
    return await getDueSurvey(getDb(), userId);
  } catch {
    // 체감 질문은 부가 기능이라 실패하면 그냥 묻지 않는다.
    return null;
  }
}

export type SaveSurveyActionResult =
  | { ok: true }
  | { ok: false; code: "UNAUTHORIZED" | "INVALID_INPUT" | "NOT_ASKED" | "SERVER_ERROR" };

/** "맞았다/아니다" 응답을 저장한다. */
export async function saveSurvey(payload: unknown): Promise<SaveSurveyActionResult> {
  const userId = (await getCurrentUser())?.id;
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const parsed = saveSurveySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, code: "INVALID_INPUT" };
  if (!isDbConfigured()) return { ok: false, code: "SERVER_ERROR" };

  try {
    const result = await saveSurveyRecord(getDb(), { userId, ...parsed.data });
    return result.status === "saved" ? { ok: true } : { ok: false, code: "NOT_ASKED" };
  } catch {
    return { ok: false, code: "SERVER_ERROR" };
  }
}
