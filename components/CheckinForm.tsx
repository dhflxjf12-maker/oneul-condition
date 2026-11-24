"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getBrowserStorage, loadDraft, loadLevel, saveDraft, saveLevel } from "@/lib/checkin-storage";
import {
  CHECKIN_ITEM_LABELS,
  LEVEL_LABELS,
  RATING_ENDPOINT_LABELS,
  SLEEP_BAND_LABELS,
  YESTERDAY_LOAD_OPTIONS,
} from "@/lib/domain/constants";
import { REQUIRED_ITEM_KEYS, createEmptySoreness, findMissingItems } from "@/lib/domain/score";
import type { CheckinInput, ExerciseLevel, Rating, Soreness } from "@/lib/domain/types";
import { Button } from "./Button";
import { Card } from "./Card";
import { ChoiceChips, type ChipOption } from "./ChoiceChips";
import { SorenessPicker, type SorenessMode } from "./SorenessPicker";

// Design Ref: §5.2·§5.5 체크인 화면 — 운동 수준 + 6개 항목 선택형 입력, [점수 보기]는 항상 누를 수 있다.
// Plan SC: 모든 항목이 선택형(직접 입력 칸 없음)이라 60초 안에 끝낼 수 있다. (작업 6번)

/** 입력을 마쳤을 때 화면이 받는 값 */
export type CheckinResult = {
  input: CheckinInput;
  level: ExerciseLevel;
  /** 체크인 소요 시간(초): 첫 입력부터 [점수 보기]까지. 측정하지 못했으면 없음 (지표 측정용 이용 기록) */
  durationSeconds?: number;
};

/** 소요 시간으로 인정하는 상한(초). 이보다 길면 중간에 자리를 비운 것으로 보고 기록하지 않는다. */
const MAX_DURATION_SECONDS = 60 * 60;

/** 필수 항목 5개 (근육통은 처음부터 "없음"으로 완료 상태) */
type RequiredKey = (typeof REQUIRED_ITEM_KEYS)[number];
type Draft = Partial<Pick<CheckinInput, RequiredKey>>;

// ---- 선택지 (이름·설명은 lib/domain/constants.ts 한 곳에서만 가져온다) ----
const LEVEL_OPTIONS: readonly ChipOption<ExerciseLevel>[] = [
  { value: "hobby", label: LEVEL_LABELS.hobby },
  { value: "athlete", label: LEVEL_LABELS.athlete },
];

const SLEEP_BAND_OPTIONS: readonly ChipOption<Rating>[] = SLEEP_BAND_LABELS.map((label, i) => ({
  value: (i + 1) as Rating,
  label,
}));

const RATING_OPTIONS: readonly ChipOption<Rating>[] = [1, 2, 3, 4, 5].map((n) => ({
  value: n as Rating,
  label: String(n),
}));

const YESTERDAY_LOAD_CHIPS: readonly ChipOption<Rating>[] = YESTERDAY_LOAD_OPTIONS.map((option, i) => ({
  value: (i + 1) as Rating,
  label: option.label,
}));

/** 1~5 단계 항목 설명: "1 = 매우 나쁨 · 5 = 매우 좋음" */
function endpointHint(low: string, high: string): string {
  return `1 = ${low} · 5 = ${high}`;
}

/** 빈 곳 없이 채워졌으면 CheckinInput으로, 아니면 null */
function toCheckinInput(draft: Draft, soreness: Soreness): CheckinInput | null {
  const { sleepBand, sleepQuality, fatigue, mood, yesterdayLoad } = draft;
  if (
    sleepBand === undefined ||
    sleepQuality === undefined ||
    fatigue === undefined ||
    mood === undefined ||
    yesterdayLoad === undefined
  ) {
    return null;
  }
  return { sleepBand, sleepQuality, fatigue, soreness, mood, yesterdayLoad };
}

type CheckinFormProps = {
  /** 6개 항목을 모두 채우고 [점수 보기]를 눌렀을 때 부른다. */
  onComplete: (result: CheckinResult) => void;
};

/** 체크인 입력 폼 */
export function CheckinForm({ onComplete }: CheckinFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  // 체크인을 시작한 시각 (이 화면에서 처음 입력을 바꾼 때). 저장해 둔 값을 불러오기만 한 것은 시작으로 보지 않는다.
  const startedAtRef = useRef<number | null>(null);
  // 운동 수준 기본값은 애호가 (PRD에 정해진 기본값이 없어서 가장 넓은 대상으로 둠)
  const [level, setLevel] = useState<ExerciseLevel>("hobby");
  const [draft, setDraft] = useState<Draft>({});
  const [sorenessMode, setSorenessMode] = useState<SorenessMode>("none");
  const [soreness, setSoreness] = useState<Soreness>(createEmptySoreness);
  const [missing, setMissing] = useState<RequiredKey[]>([]);
  // 브라우저에 보관된 값을 불러오기 전에는 저장하지 않는다. (빈 값으로 덮어쓰는 것을 막음)
  const [restored, setRestored] = useState(false);

  // Design Ref: §2.2 — 화면이 열리면 오늘 보관된 입력값과 마지막 운동 수준을 불러온다.
  // 서버에서 먼저 그려진 화면과 어긋나지 않도록 마운트 뒤에 불러온다.
  useEffect(() => {
    const storage = getBrowserStorage();
    const savedLevel = loadLevel(storage);
    const savedDraft = loadDraft(storage);
    /* eslint-disable react-hooks/set-state-in-effect -- 브라우저 저장소는 마운트 뒤에만 읽을 수 있다 */
    if (savedLevel) setLevel(savedLevel);
    if (savedDraft) {
      setDraft(savedDraft.items);
      setSorenessMode(savedDraft.sorenessMode);
      setSoreness(savedDraft.soreness);
    }
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 입력이 바뀔 때마다 보관한다.
  useEffect(() => {
    if (!restored) return;
    const storage = getBrowserStorage();
    saveDraft(storage, { items: draft, sorenessMode, soreness });
    saveLevel(storage, level);
  }, [restored, draft, sorenessMode, soreness, level]);

  // 근육통은 처음부터 "없음"으로 완료 상태라서 진행은 1/6에서 시작한다.
  const doneCount = REQUIRED_ITEM_KEYS.filter((key) => draft[key] !== undefined).length + 1;

  function setItem(key: RequiredKey, value: Rating) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    // 빠졌다고 알린 항목을 고르면 그 안내는 사라진다.
    setMissing((previous) => previous.filter((item) => item !== key));
  }

  function errorFor(key: RequiredKey): string | undefined {
    return missing.includes(key) ? "이 항목을 선택해 주세요." : undefined;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input = toCheckinInput(draft, soreness);
    const missingItems = findMissingItems(draft);
    if (input === null || missingItems.length > 0) {
      // 점수를 내지 않고, 빠진 항목을 알려 준 뒤 첫 번째 빠진 항목으로 포커스를 옮긴다.
      setMissing(missingItems);
      const first = missingItems[0];
      if (first) {
        formRef.current?.querySelector<HTMLInputElement>(`[data-item="${first}"] input`)?.focus();
      }
      return;
    }

    setMissing([]);
    const startedAt = startedAtRef.current;
    const seconds = startedAt === null ? null : Math.round((Date.now() - startedAt) / 1000);
    // 다음 체크인(입력 고치기)은 새로 시작한 것으로 센다.
    startedAtRef.current = null;
    onComplete({
      input,
      level,
      durationSeconds: seconds !== null && seconds <= MAX_DURATION_SECONDS ? seconds : undefined,
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      // 칩을 처음 고르는 순간을 체크인 시작으로 본다. (입력 변경 이벤트는 폼까지 올라온다)
      onChange={() => {
        startedAtRef.current ??= Date.now();
      }}
      noValidate className="flex flex-col gap-4">
      <Card aria-label="진행 상황" className="!py-3">
        <p role="status" className="font-semibold">
          {doneCount}/6 완료
        </p>
      </Card>

      <Card>
        <ChoiceChips
          legend="운동 수준"
          hint="제안하는 운동 시간을 정할 때 써요."
          name="level"
          itemKey="level"
          options={LEVEL_OPTIONS}
          value={level}
          onChange={setLevel}
        />
      </Card>

      <Card>
        <ChoiceChips
          legend={CHECKIN_ITEM_LABELS.sleepBand}
          name="item-sleepBand"
          itemKey="sleepBand"
          options={SLEEP_BAND_OPTIONS}
          value={draft.sleepBand}
          onChange={(value) => setItem("sleepBand", value)}
          errorText={errorFor("sleepBand")}
        />
      </Card>

      <Card>
        <ChoiceChips
          legend={CHECKIN_ITEM_LABELS.sleepQuality}
          hint={endpointHint(RATING_ENDPOINT_LABELS.sleepQuality.low, RATING_ENDPOINT_LABELS.sleepQuality.high)}
          name="item-sleepQuality"
          itemKey="sleepQuality"
          options={RATING_OPTIONS}
          value={draft.sleepQuality}
          onChange={(value) => setItem("sleepQuality", value)}
          errorText={errorFor("sleepQuality")}
        />
      </Card>

      <Card>
        <ChoiceChips
          legend={CHECKIN_ITEM_LABELS.fatigue}
          hint={endpointHint(RATING_ENDPOINT_LABELS.fatigue.low, RATING_ENDPOINT_LABELS.fatigue.high)}
          name="item-fatigue"
          itemKey="fatigue"
          options={RATING_OPTIONS}
          value={draft.fatigue}
          onChange={(value) => setItem("fatigue", value)}
          errorText={errorFor("fatigue")}
        />
      </Card>

      <Card>
        <SorenessPicker
          mode={sorenessMode}
          soreness={soreness}
          onModeChange={setSorenessMode}
          onSorenessChange={setSoreness}
        />
      </Card>

      <Card>
        <ChoiceChips
          legend={CHECKIN_ITEM_LABELS.mood}
          hint={endpointHint(RATING_ENDPOINT_LABELS.mood.low, RATING_ENDPOINT_LABELS.mood.high)}
          name="item-mood"
          itemKey="mood"
          options={RATING_OPTIONS}
          value={draft.mood}
          onChange={(value) => setItem("mood", value)}
          errorText={errorFor("mood")}
        />
      </Card>

      <Card>
        <ChoiceChips
          legend={CHECKIN_ITEM_LABELS.yesterdayLoad}
          name="item-yesterdayLoad"
          itemKey="yesterdayLoad"
          options={YESTERDAY_LOAD_CHIPS}
          value={draft.yesterdayLoad}
          onChange={(value) => setItem("yesterdayLoad", value)}
          errorText={errorFor("yesterdayLoad")}
        />
        <details className="mt-3">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold">단계별 기준 보기</summary>
          <ul className="mt-1 flex flex-col gap-1 text-ink-sub">
            {YESTERDAY_LOAD_OPTIONS.map((option) => (
              <li key={option.label}>
                <span className="font-semibold text-ink">{option.label}</span>: {option.description}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card>
        {missing.length > 0 ? (
          <p role="alert" className="mb-3 font-semibold text-danger">
            <span aria-hidden="true">⚠ </span>
            빠진 항목이 있어요: {missing.map((key) => CHECKIN_ITEM_LABELS[key]).join(", ")}
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          점수 보기
        </Button>
      </Card>
    </form>
  );
}
