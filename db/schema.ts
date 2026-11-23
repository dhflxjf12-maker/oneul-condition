import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ExerciseLevel, Intensity, Soreness, Suggestion, SuggestionSource } from "../lib/domain/types";

// Design Ref: §3.1 데이터 모델 — users, checkins, survey_responses, ai_calls, login_attempts.
// 실제 표는 db/migrations/*.sql 이 만들고, 이 파일은 코드에서 쓸 때의 모양(타입)을 알려 준다. 둘은 항상 같게 유지한다.
// 비로그인 사용자의 체크인 값은 어떤 표에도 저장하지 않는다. (PRD 개인정보 규칙)

/** 계정 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    level: text("level").$type<ExerciseLevel>().notNull().default("hobby"),
    healthConsentAt: timestamp("health_consent_at", { withTimezone: true }).notNull(),
    ageConfirmed: boolean("age_confirmed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_key").on(table.email)],
);

/** 체크인 기록 (로그인 사용자만, 하루 1건) */
export const checkins = pgTable(
  "checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 한국 시간 기준 날짜 */
    checkinDate: date("checkin_date", { mode: "string" }).notNull(),
    sleepBand: smallint("sleep_band").notNull(),
    sleepQuality: smallint("sleep_quality").notNull(),
    fatigue: smallint("fatigue").notNull(),
    soreness: jsonb("soreness").$type<Soreness>().notNull(),
    mood: smallint("mood").notNull(),
    yesterdayLoad: smallint("yesterday_load").notNull(),
    level: text("level").$type<ExerciseLevel>().notNull(),
    score: smallint("score").notNull(),
    intensity: text("intensity").$type<Intensity>().notNull(),
    suggestion: jsonb("suggestion").$type<Suggestion>(),
    suggestionSource: text("suggestion_source").$type<SuggestionSource>(),
    feedback: text("feedback").$type<"up" | "down">(),
    durationSeconds: integer("duration_seconds"),
    suggestionViewed: boolean("suggestion_viewed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("checkins_user_date_key").on(table.userId, table.checkinDate),
    check("checkins_score_range", sql`${table.score} between 0 and 100`),
  ],
);

/** 주 1회 체감 질문 응답 */
export const surveyResponses = pgTable(
  "survey_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 질문 대상 주(지난주)의 월요일, 한국 시간 */
    weekStart: date("week_start", { mode: "string" }).notNull(),
    askedAt: timestamp("asked_at", { withTimezone: true }).notNull().defaultNow(),
    matched: boolean("matched"),
  },
  (table) => [uniqueIndex("survey_user_week_key").on(table.userId, table.weekStart)],
);

/** AI 호출 횟수 (체크인 값은 저장하지 않음). subject_key = 로그인 사용자 번호 또는 익명 기기 번호 */
export const aiCalls = pgTable(
  "ai_calls",
  {
    subjectKey: text("subject_key").notNull(),
    callDate: date("call_date", { mode: "string" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.subjectKey, table.callDate] }), index("ai_calls_date_idx").on(table.callDate)],
);

/** 로그인 시도 기록 (이메일 해시 기준, 가입 여부와 무관) */
export const loginAttempts = pgTable("login_attempts", {
  emailHash: text("email_hash").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastFailedAt: timestamp("last_failed_at", { withTimezone: true }).notNull().defaultNow(),
});
