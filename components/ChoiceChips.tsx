"use client";

import { useId } from "react";

// Design Ref: §5.4 — 5단계 선택 칩 (44px 이상, 키보드·화면 읽기 지원).
// 진짜 라디오 버튼(<input type="radio">)을 칩 모양으로 꾸며서, 방향키·Tab 이동과 화면 읽기가 기본으로 된다.
// 선택된 칩은 색뿐 아니라 ✓ 표시로도 알 수 있게 한다.

/** 칩 하나(선택지)의 값과 화면에 보일 글자 */
export type ChipOption<T extends string | number> = {
  value: T;
  label: string;
};

type ChoiceChipsProps<T extends string | number> = {
  /** 이 선택 묶음의 이름(제목). 화면 읽기 프로그램은 이 이름으로 묶음을 읽는다. */
  legend: string;
  /** 제목 아래 보조 설명 (예: "1 = 매우 나쁨 · 5 = 매우 좋음") */
  hint?: string;
  /** 같은 묶음의 라디오 버튼이 공유하는 이름 (화면 안에서 겹치지 않게) */
  name: string;
  options: readonly ChipOption<T>[];
  /** 지금 선택된 값 (아직 고르지 않았으면 undefined) */
  value: T | undefined;
  onChange: (value: T) => void;
  /** 이 항목이 빠졌다고 알릴 때 보여 줄 문구 (없으면 표시하지 않음) */
  errorText?: string;
  /** 제목 글자 크기: normal(기본) 또는 small(묶음 안의 작은 묶음) */
  legendSize?: "normal" | "small";
  /** 폼에서 이 항목을 찾아 포커스를 줄 때 쓰는 이름 */
  itemKey?: string;
  /** 좁은 칩: 숫자만 있는 칩(0~5)이 휴대폰 화면 한 줄에 모두 들어가도록 간격·여백을 줄인다. (칩 크기는 그대로 44px 이상) */
  compact?: boolean;
};

/** 칩 모양 라디오 선택 묶음 */
export function ChoiceChips<T extends string | number>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  errorText,
  legendSize = "normal",
  itemKey,
  compact = false,
}: ChoiceChipsProps<T>) {
  const errorId = useId();
  const hintId = useId();

  const describedBy = [hint ? hintId : null, errorText ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset data-item={itemKey} aria-describedby={describedBy} className="m-0 min-w-0 border-0 p-0">
      <legend className={legendSize === "small" ? "text-base font-semibold" : "text-lg font-bold"}>{legend}</legend>

      {hint ? (
        <p id={hintId} className="mt-1 text-base text-ink-sub">
          {hint}
        </p>
      ) : null}

      <div className={`mt-3 flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label key={String(option.value)} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={String(option.value)}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                className={`flex min-h-11 min-w-11 items-center justify-center rounded-control border-2 py-2 text-base font-semibold transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
                  compact ? "px-2" : "px-4"
                } ${
                  selected
                    ? "border-accent bg-accent text-white"
                    : "border-control-line bg-card text-ink hover:bg-card-tint"
                }`}
              >
                {selected ? (
                  <span aria-hidden="true" className="mr-1">
                    ✓
                  </span>
                ) : null}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      {errorText ? (
        <p id={errorId} className="mt-2 text-base font-semibold text-danger">
          <span aria-hidden="true">⚠ </span>
          {errorText}
        </p>
      ) : null}
    </fieldset>
  );
}
