"use server";

import { redirect } from "next/navigation";
import { getDb, isDbConfigured } from "@/db";
import { hashEmail, isEmailHashConfigured } from "@/lib/auth/email-hash";
import { attemptLogin } from "@/lib/auth/login";
import { createSession, deleteSession, isSessionConfigured } from "@/lib/auth/session";
import { createUser } from "@/lib/auth/signup";
import { LOGIN_FAILED_MESSAGE, parseLoginForm, parseSignupForm, type SignupField } from "@/lib/auth/validation";

// Design Ref: §4.1 signup·login·logout — 가입(검사 → 해시 → 저장 → 세션 발급), 로그인(잠금 확인 → 비밀번호 비교 → 세션 발급), 로그아웃(세션 삭제).
// 성공하면 첫 화면으로 보낸다.

export type SignupState =
  | undefined
  | {
      /** 입력칸 아래에 보여 줄 필드별 오류 */
      errors?: Partial<Record<SignupField, string>>;
      /** 폼 위에 보여 줄 전체 오류 */
      message?: string;
      /** 오류 뒤에도 다시 채워 둘 이메일 (비밀번호는 다시 채우지 않는다) */
      email?: string;
    };

const DUPLICATE_MESSAGE = "가입할 수 없습니다. 이미 가입했다면 로그인해 주세요.";

export async function signup(_previous: SignupState, formData: FormData): Promise<SignupState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";

  const parsed = parseSignupForm({
    email: formData.get("email"),
    password: formData.get("password"),
    ageConfirmed: formData.get("ageConfirmed"),
    healthConsent: formData.get("healthConsent"),
  });
  if (!parsed.ok) return { errors: parsed.errors, email };

  // 서버 설정이 덜 끝났으면 계정을 만들지 않는다. (만들어 놓고 로그인을 못 시키는 상황 방지)
  if (!isDbConfigured() || !isSessionConfigured()) {
    return { message: "서버 설정이 아직 끝나지 않아 지금은 가입할 수 없어요. 관리자에게 알려 주세요.", email };
  }

  let userId: string;
  try {
    const result = await createUser(getDb(), parsed.data);
    if (result.status === "duplicate") return { message: DUPLICATE_MESSAGE, email };
    userId = result.userId;
  } catch {
    return { message: "가입 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", email };
  }

  await createSession(userId);
  redirect("/");
}

export type LoginState =
  | undefined
  | {
      /** 폼 위에 보여 줄 오류 */
      message?: string;
      /** 오류 뒤에도 다시 채워 둘 이메일 */
      email?: string;
    };

/** 남은 시간을 "9분 30초"처럼 읽기 쉽게 */
function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}초`;
  return rest === 0 ? `${minutes}분` : `${minutes}분 ${rest}초`;
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";

  const parsed = parseLoginForm({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.ok) return { message: parsed.message, email };

  if (!isDbConfigured() || !isSessionConfigured() || !isEmailHashConfigured()) {
    return { message: "서버 설정이 아직 끝나지 않아 지금은 로그인할 수 없어요. 관리자에게 알려 주세요.", email };
  }

  let userId: string;
  try {
    const result = await attemptLogin(getDb(), {
      email: parsed.email,
      emailHash: hashEmail(parsed.email),
      password: parsed.password,
    });
    if (result.status === "locked") {
      return {
        message: `로그인 시도가 너무 많아 잠겼어요. ${formatRemaining(result.remainingSeconds)} 뒤에 다시 시도해 주세요.`,
        email,
      };
    }
    if (result.status === "invalid") return { message: LOGIN_FAILED_MESSAGE, email };
    userId = result.userId;
  } catch {
    return { message: "로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", email };
  }

  await createSession(userId);
  redirect("/");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/");
}
