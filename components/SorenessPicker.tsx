"use client";

import {
  CHECKIN_ITEM_LABELS,
  SORENESS_MAX_POINT,
  SORENESS_MIN_POINT,
  SORENESS_PARTS,
  SORENESS_PART_LABELS,
} from "@/lib/domain/constants";
import { createEmptySoreness } from "@/lib/domain/score";
import type { Soreness, SorenessPoint } from "@/lib/domain/types";
import { ChoiceChips, type ChipOption } from "./ChoiceChips";

// Design Ref: §5.2 — 근육통 카드: 처음에는 "아픈 곳 없음"이 선택된 상태이고,
// "아픈 곳 선택"을 누르면 6부위(어깨·등·팔·가슴·복부·하체)가 나타나 각각 0~5점으로 고른다.

/** 근육통 입력 방식: none = 아픈 곳 없음, some = 아픈 곳 선택 */
export type SorenessMode = "none" | "some";

const MODE_OPTIONS: readonly ChipOption<SorenessMode>[] = [
  { value: "none", label: "아픈 곳 없음" },
  { value: "some", label: "아픈 곳 선택" },
];

// 0(없음)~5(매우 심함) 점수 칩
const POINT_OPTIONS: readonly ChipOption<SorenessPoint>[] = Array.from(
  { length: SORENESS_MAX_POINT - SORENESS_MIN_POINT + 1 },
  (_, i) => {
    const point = (SORENESS_MIN_POINT + i) as SorenessPoint;
    return { value: point, label: String(point) };
  },
);

type SorenessPickerProps = {
  mode: SorenessMode;
  soreness: Soreness;
  onModeChange: (mode: SorenessMode) => void;
  onSorenessChange: (soreness: Soreness) => void;
};

/** 근육통 입력 (모드 선택 + 6부위 점수) */
export function SorenessPicker({ mode, soreness, onModeChange, onSorenessChange }: SorenessPickerProps) {
  function handleModeChange(next: SorenessMode) {
    // "아픈 곳 없음"으로 돌아가면 입력했던 점수를 모두 0(통증 없음)으로 되돌린다.
    if (next === "none") onSorenessChange(createEmptySoreness());
    onModeChange(next);
  }

  return (
    <div>
      <ChoiceChips
        legend={CHECKIN_ITEM_LABELS.soreness}
        hint="아픈 곳이 있으면 부위별로 0(없음)~5(매우 심함)점을 골라 주세요."
        name="item-soreness-mode"
        itemKey="soreness"
        options={MODE_OPTIONS}
        value={mode}
        onChange={handleModeChange}
      />

      {mode === "some" ? (
        <div className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
          {SORENESS_PARTS.map((part) => (
            <ChoiceChips
              key={part}
              legend={`${SORENESS_PART_LABELS[part]} 근육통`}
              legendSize="small"
              compact
              name={`item-soreness-${part}`}
              options={POINT_OPTIONS}
              value={soreness[part]}
              onChange={(point) => onSorenessChange({ ...soreness, [part]: point })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
