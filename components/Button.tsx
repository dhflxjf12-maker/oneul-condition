import type { ButtonHTMLAttributes } from "react";

// Design Ref: 디자인 기준 — 눌러야 하는 버튼은 높이·너비 44px 이상(min-h-11 = 2.75rem), 모서리 12px, 글자 16px 이상.
export type ButtonVariant = "primary" | "secondary";

const BASE =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-5 py-2 text-base font-semibold transition-colors";

const VARIANTS: Record<ButtonVariant, string> = {
  // 주요 버튼: 진한 골드 바탕 + 흰 글자 (대비 6.3:1)
  primary: "bg-accent text-white hover:bg-accent-hover",
  // 보조 버튼: 흰 바탕 + 진한 글자 + 또렷한 테두리 (테두리 대비 4.2:1)
  secondary: "border-2 border-control-line bg-card text-ink hover:bg-card-tint",
};

/** 링크(`<Link>`)를 버튼 모양으로 그릴 때도 같은 모양을 쓰도록 클래스만 돌려준다. */
export function buttonClassName(variant: ButtonVariant = "primary", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

/** 공통 버튼. 기본 종류는 type="button"이라 폼 안에서도 실수로 제출되지 않는다. */
export function Button({ variant = "primary", type = "button", className = "", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClassName(variant, className)} {...rest} />;
}
