-- 모든 표에 행 수준 보안(RLS)을 켠다.
-- 이유: Supabase는 public 표를 공개 API(anon 키)로도 열어 둔다. 정책이 없는 RLS는 그 API로 읽기·쓰기를 모두 막는다.
-- 이 앱 서버는 데이터베이스 소유자 권한으로 직접 연결하므로 RLS의 영향을 받지 않고 그대로 동작한다.
-- 이 앱은 Supabase의 공개 API를 쓰지 않는다. 앞으로 표를 추가할 때도 같은 파일에 RLS를 함께 켠다.

ALTER TABLE users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE _migrations      ENABLE ROW LEVEL SECURITY;
