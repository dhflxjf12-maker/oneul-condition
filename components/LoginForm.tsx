"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { ADMIN_CONTACT_EMAIL } from "@/lib/site";
import { Button } from "./Button";
import { Card } from "./Card";

// Design Ref: §5.2 로그인 화면 — 이메일, 비밀번호, [로그인], 문의 안내.
// 실패 문구는 항상 같은 한 문장이며, 오류는 색뿐 아니라 ⚠ 글자로도 알린다.

const INPUT_CLASS =
  "mt-2 block min-h-11 w-full rounded-control border-2 border-control-line bg-card px-3 py-2 text-base text-ink";

/** 로그인 폼 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);

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
          className={INPUT_CLASS}
        />
      </Card>

      <Card>
        <label htmlFor="password" className="text-lg font-bold">
          비밀번호
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" className={INPUT_CLASS} />
      </Card>

      <Card>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "로그인하는 중…" : "로그인"}
        </Button>
      </Card>

      <Card>
        <p className="text-ink-sub">
          비밀번호를 잊으셨나요? 가입한 이메일 주소로 관리자에게 문의해 주세요.
          {ADMIN_CONTACT_EMAIL ? (
            <>
              {" "}
              문의 주소:{" "}
              <a href={`mailto:${ADMIN_CONTACT_EMAIL}`} className="font-semibold text-accent underline">
                {ADMIN_CONTACT_EMAIL}
              </a>
            </>
          ) : null}
        </p>
      </Card>
    </form>
  );
}
