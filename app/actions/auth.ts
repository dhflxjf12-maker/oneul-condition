"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, isDbConfigured } from "@/db";
import { deleteAccountRecord } from "@/lib/accounts/delete";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashEmail, isEmailHashConfigured } from "@/lib/auth/email-hash";
import { attemptLogin } from "@/lib/auth/login";
import { createSession, deleteSession, isSessionConfigured } from "@/lib/auth/session";
import { revokeSessions } from "@/lib/auth/revoke";
import { createUser } from "@/lib/auth/signup";
import { MAX_LOGIN_TRIES_PER_IP_PER_DAY, MAX_SIGNUPS_PER_IP_PER_DAY } from "@/lib/domain/constants";
import { ipKeyFrom } from "@/lib/request-ip";
import { consumeDailyLimit } from "@/lib/suggestion/limit";
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
const TOO_MANY_MESSAGE = "오늘은 시도 횟수를 넘었어요. 내일 다시 시도해 주세요.";

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

  // 같은 곳(IP)에서 하루에 너무 많이 가입하려는 경우를 막는다. (가짜 계정 대량 생성 방지)
  if (!(await consumeDailyLimit(`signup:${ipKeyFrom(await headers())}`, MAX_SIGNUPS_PER_IP_PER_DAY))) {
    return { message: TOO_MANY_MESSAGE, email };
  }

  let userId: string;
  let sessionVersion: number;
  try {
    const result = await createUser(getDb(), parsed.data);
    if (result.status === "duplicate") return { message: DUPLICATE_MESSAGE, email };
    userId = result.userId;
    sessionVersion = result.sessionVersion;
  } catch {
    return { message: "가입 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", email };
  }

  await createSession(userId, sessionVersion);
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

  // 이메일을 바꿔 가며 대입하는 공격을 막으려고, 같은 곳(IP)에서 하루에 시도할 수 있는 횟수도 제한한다.
  if (!(await consumeDailyLimit(`login:${ipKeyFrom(await headers())}`, MAX_LOGIN_TRIES_PER_IP_PER_DAY))) {
    return { message: TOO_MANY_MESSAGE, email };
  }

  let userId: string;
  let sessionVersion: number;
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
    sessionVersion = result.sessionVersion;
  } catch {
    return { message: "로그인 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", email };
  }

  await createSession(userId, sessionVersion);
  redirect("/");
}

export async function logout(): Promise<void> {
  // 쿠키만 지우면 복사해 둔 쿠키는 30일간 계속 쓸 수 있으므로, 이 계정의 세션 번호를 올려서 이전 로그인을 모두 무효로 만든다.
  // (다른 기기에서 로그인한 것도 함께 로그아웃된다.) 실패해도 이 기기의 쿠키는 지운다.
  try {
    const user = await getCurrentUser();
    if (user) await revokeSessions(getDb(), user.id);
  } catch {
    // 아래에서 쿠키는 지운다.
  }
  await deleteSession();
  redirect("/");
}

export type DeleteAccountState = undefined | { message: string };

/**
 * 내 계정과 기록을 모두 삭제한다. 되돌릴 수 없다. (화면에서 한 번 더 확인한 뒤에만 부른다)
 * 삭제할 계정은 세션에서만 정하며, 화면이 보내는 값은 쓰지 않는다.
 */
export async function deleteAccount(): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    const emailHash = isEmailHashConfigured() ? hashEmail(user.email) : null;
    await deleteAccountRecord(getDb(), { userId: user.id, emailHash });
  } catch {
    return { message: "계정을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요." };
  }

  await deleteSession();
  redirect("/");
}
