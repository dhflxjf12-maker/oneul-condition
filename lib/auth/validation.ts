import { z } from "zod";
import { MIN_SIGNUP_AGE, PASSWORD_MIN_LENGTH } from "../domain/constants";

// Design Ref: §4.3 — 모든 입력을 Zod로 검사하고, 틀리면 필드별 오류 문구를 돌려준다. (가입: 이메일, 비밀번호 8자 이상, 14세 확인, 건강 정보 동의)

/** 비밀번호 최대 길이 (너무 긴 입력으로 서버가 느려지는 것을 막는 상한) */
export const PASSWORD_MAX_LENGTH = 128;
/** 이메일 최대 길이 (표준 상한) */
export const EMAIL_MAX_LENGTH = 254;

export const signupSchema = z.object({
  // 앞뒤 공백을 지우고 소문자로 맞춘다. (같은 이메일이 대소문자 차이로 두 번 가입되지 않게)
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "이메일을 입력해 주세요.")
    .max(EMAIL_MAX_LENGTH, "이메일이 너무 길어요.")
    .pipe(z.email("이메일 형식이 올바르지 않아요. 예: name@example.com")),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 해요.`)
    .max(PASSWORD_MAX_LENGTH, `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 해요.`),
  ageConfirmed: z.literal(true, { error: `만 ${MIN_SIGNUP_AGE}세 이상임을 확인해 주세요.` }),
  healthConsent: z.literal(true, { error: "건강 정보 수집·이용에 동의해 주세요." }),
});

export type SignupField = "email" | "password" | "ageConfirmed" | "healthConsent";
export type SignupInput = z.output<typeof signupSchema>;

export type SignupParseResult =
  | { ok: true; data: SignupInput }
  | { ok: false; errors: Partial<Record<SignupField, string>> };

/** 폼 값(체크박스는 체크하면 "on")을 검사한다. 필드마다 첫 번째 오류 문구만 돌려준다. */
export function parseSignupForm(raw: { email?: unknown; password?: unknown; ageConfirmed?: unknown; healthConsent?: unknown }): SignupParseResult {
  const parsed = signupSchema.safeParse({
    email: typeof raw.email === "string" ? raw.email : "",
    password: typeof raw.password === "string" ? raw.password : "",
    ageConfirmed: raw.ageConfirmed === "on" || raw.ageConfirmed === true,
    healthConsent: raw.healthConsent === "on" || raw.healthConsent === true,
  });
  if (parsed.success) return { ok: true, data: parsed.data };

  const errors: Partial<Record<SignupField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as SignupField;
    if (!errors[field]) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
