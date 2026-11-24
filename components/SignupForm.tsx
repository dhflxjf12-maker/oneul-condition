"use client";

import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { MIN_SIGNUP_AGE, PASSWORD_MIN_LENGTH } from "@/lib/domain/constants";
import { Button } from "./Button";
import { Card } from "./Card";

// Design Ref: §5.2 가입 화면 — 이메일, 비밀번호(8자 이상), ☐ 만 14세 이상입니다, ☐ 건강 정보 수집·이용에 동의합니다, [가입].
// 오류는 색뿐 아니라 ⚠ 표시와 글자로 알리고, 입력칸·체크박스는 44px 이상으로 만든다.

const INPUT_CLASS =
  "mt-2 block min-h-11 w-full rounded-control border-2 border-control-line bg-card px-3 py-2 text-base text-ink";

type FieldErrorProps = { id: string; text?: string };

function FieldError({ id, text }: FieldErrorProps) {
  if (!text) return null;
  return (
    <p id={id} className="mt-2 text-base font-semibold text-danger">
      <span aria-hidden="true">⚠ </span>
      {text}
    </p>
  );
}

/** 회원가입 폼 */
export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const errors = state?.errors;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {state?.message ? (
        <Card>
          <p role="alert" className="font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            {state.message}
          </p>
        </Card>
      ) : null}

      <Card>
        <label htmlFor="email" className="text-lg font-bold">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.email ?? ""}
          aria-invalid={errors?.email ? true : undefined}
          aria-describedby={errors?.email ? "email-error" : undefined}
          className={INPUT_CLASS}
        />
        <FieldError id="email-error" text={errors?.email} />
      </Card>

      <Card>
        <label htmlFor="password" className="text-lg font-bold">
          비밀번호
        </label>
        <p id="password-hint" className="mt-1 text-ink-sub">
          {PASSWORD_MIN_LENGTH}자 이상으로 만들어 주세요.
        </p>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors?.password ? true : undefined}
          aria-describedby={errors?.password ? "password-hint password-error" : "password-hint"}
          className={INPUT_CLASS}
        />
        <FieldError id="password-error" text={errors?.password} />
      </Card>

      <Card className="flex flex-col gap-4">
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base font-semibold">
            <input
              type="checkbox"
              name="ageConfirmed"
              aria-invalid={errors?.ageConfirmed ? true : undefined}
              aria-describedby={errors?.ageConfirmed ? "age-error" : undefined}
              className="size-6 shrink-0 accent-accent"
            />
            만 {MIN_SIGNUP_AGE}세 이상입니다
          </label>
          <FieldError id="age-error" text={errors?.ageConfirmed} />
        </div>

        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-base font-semibold">
            <input
              type="checkbox"
              name="healthConsent"
              aria-invalid={errors?.healthConsent ? true : undefined}
              aria-describedby={errors?.healthConsent ? "consent-error consent-detail" : "consent-detail"}
              className="mt-1 size-6 shrink-0 accent-accent"
            />
            건강 정보 수집·이용에 동의합니다
          </label>
          <p id="consent-detail" className="mt-1 pl-9 text-ink-sub">
            체크인에서 입력한 수면·피로·근육통 같은 컨디션 기록을 로그인한 계정에 저장하는 데 쓰며, 계정을 삭제하면 함께
            지워져요.
          </p>
          <FieldError id="consent-error" text={errors?.healthConsent} />
        </div>
      </Card>

      <Card>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "가입하는 중…" : "가입"}
        </Button>
      </Card>
    </form>
  );
}
