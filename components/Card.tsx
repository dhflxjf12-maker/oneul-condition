import type { HTMLAttributes, ReactNode } from "react";

// Design Ref: §5.4, 디자인 기준 — 모든 내용은 흰색 카드 위에 올린다. 카드 위 글자는 진한 갈색(대비 17:1).
type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  /** 어떤 HTML 요소로 그릴지 (기본: section) */
  as?: "section" | "div" | "header" | "aside";
};

/** 흰색 카드 한 장. 모서리 16px, 안쪽 여백 20px(넓은 화면 24px). */
export function Card({ as: Tag = "section", className = "", children, ...rest }: CardProps) {
  return (
    <Tag
      className={`rounded-card bg-card p-5 text-ink shadow-sm sm:p-6 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
