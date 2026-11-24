"use server";

import { redirect } from "next/navigation";
import { getDb, isDbConfigured } from "@/db";
import { createSession, isSessionConfigured } from "@/lib/auth/session";
import { createUser } from "@/lib/auth/signup";
import { parseSignupForm, type SignupField } from "@/lib/auth/validation";

// Design Ref: §4.1 signup — 가입(검사 → 해시 → 저장 → 세션 발급). 성공하면 첫 화면으로 보낸다.

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
