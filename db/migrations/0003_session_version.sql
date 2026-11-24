-- 로그아웃·비밀번호 초기화 때 기존 로그인(세션)을 즉시 무효로 만들기 위한 번호.
-- 세션 쿠키에 이 번호를 함께 담고, 요청마다 DB 값과 같은지 확인한다. 번호를 올리면 이전에 발급된 모든 세션이 끊긴다.
ALTER TABLE users ADD COLUMN session_version integer NOT NULL DEFAULT 0;
