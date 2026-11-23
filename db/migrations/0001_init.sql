-- 오늘컨디션 첫 데이터베이스 구조 (Design §3.1). db/schema.ts 와 항상 같게 유지한다.
-- 이 파일은 한 번만 적용된다. 구조를 바꿀 때는 이 파일을 고치지 말고 0002_*.sql 처럼 새 파일을 추가한다.

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text        NOT NULL,
  password_hash     text        NOT NULL,
  level             text        NOT NULL DEFAULT 'hobby' CHECK (level IN ('hobby', 'athlete')),
  health_consent_at timestamptz NOT NULL,
  age_confirmed     boolean     NOT NULL CHECK (age_confirmed),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email);

CREATE TABLE checkins (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  checkin_date       date        NOT NULL,
  sleep_band         smallint    NOT NULL CHECK (sleep_band BETWEEN 1 AND 5),
  sleep_quality      smallint    NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  fatigue            smallint    NOT NULL CHECK (fatigue BETWEEN 1 AND 5),
  soreness           jsonb       NOT NULL,
  mood               smallint    NOT NULL CHECK (mood BETWEEN 1 AND 5),
  yesterday_load     smallint    NOT NULL CHECK (yesterday_load BETWEEN 1 AND 5),
  level              text        NOT NULL CHECK (level IN ('hobby', 'athlete')),
  score              smallint    NOT NULL CONSTRAINT checkins_score_range CHECK (score BETWEEN 0 AND 100),
  intensity          text        NOT NULL CHECK (intensity IN ('rest', 'light', 'moderate', 'high')),
  suggestion         jsonb,
  suggestion_source  text        CHECK (suggestion_source IN ('ai', 'fallback')),
  feedback           text        CHECK (feedback IN ('up', 'down')),
  duration_seconds   integer     CHECK (duration_seconds >= 0),
  suggestion_viewed  boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX checkins_user_date_key ON checkins (user_id, checkin_date);

CREATE TABLE survey_responses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week_start date        NOT NULL,
  asked_at   timestamptz NOT NULL DEFAULT now(),
  matched    boolean
);
CREATE UNIQUE INDEX survey_user_week_key ON survey_responses (user_id, week_start);

CREATE TABLE ai_calls (
  subject_key text    NOT NULL,
  call_date   date    NOT NULL,
  count       integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (subject_key, call_date)
);
CREATE INDEX ai_calls_date_idx ON ai_calls (call_date);

CREATE TABLE login_attempts (
  email_hash     text PRIMARY KEY,
  failed_count   integer     NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  locked_until   timestamptz,
  last_failed_at timestamptz NOT NULL DEFAULT now()
);
