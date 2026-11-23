// 규칙 코드(도메인)에서 공통으로 쓰는 타입 모음.
// Design Ref: §9.1 — 규칙(도메인) 층은 외부 의존이 없는 순수 코드로 두고, 화면과 서버가 함께 쓴다.
// Plan SC: 같은 입력이면 어디서나 같은 결과가 나오도록 타입도 한 곳에서만 정의한다. (작업 1번)

/** 운동 수준. 제안 시간 범위를 정할 때 쓴다. (hobby = 애호가, athlete = 선수) */
export type ExerciseLevel = 'hobby' | 'athlete';

/** 1~5 단계 선택값. 수면의 질·피로도·기분 등 5단계 항목에 공통으로 쓴다. */
export type Rating = 1 | 2 | 3 | 4 | 5;

/** 수면 시간 구간: 1=5시간 미만, 2=5~6시간 미만, 3=6~7시간 미만, 4=7~9시간, 5=9시간 초과 */
export type SleepBand = Rating;

/** 어제 운동량: 1=쉬었음, 2=가벼움, 3=보통, 4=강함, 5=매우 강함 */
export type YesterdayLoad = Rating;

/** 근육통 점수 한 부위당 0(없음)~5(매우 심함) */
export type SorenessPoint = 0 | 1 | 2 | 3 | 4 | 5;

/** 근육통을 입력하는 6개 부위 */
export type SorenessPart = 'shoulder' | 'back' | 'arm' | 'chest' | 'abdomen' | 'lower';

/** 부위별 근육통 점수 (고르지 않은 부위는 0점) */
export type Soreness = Record<SorenessPart, SorenessPoint>;

/** 체크인 6개 항목 입력값 (근육통은 6부위 묶음) */
export interface CheckinInput {
  sleepBand: SleepBand;
  sleepQuality: Rating;
  fatigue: Rating;
  soreness: Soreness;
  mood: Rating;
  yesterdayLoad: YesterdayLoad;
}

/** 운동 강도 (rest=휴식, light=가벼움, moderate=보통, high=높음) */
export type Intensity = 'rest' | 'light' | 'moderate' | 'high';

/** 제안하는 운동 종류 (cardio=유산소, strength=근력, recovery=스트레칭·회복) */
export type ExerciseType = 'cardio' | 'strength' | 'recovery';

/** 운동에 쓰는 부위: 근육통 6부위 중 하나 또는 전신(whole) */
export type TargetPart = SorenessPart | 'whole';

/** 제안 출처 (ai=AI가 만든 제안, fallback=기본 문구) */
export type SuggestionSource = 'ai' | 'fallback';

/** 구체적인 운동 제안 한 건 */
export interface Suggestion {
  type: ExerciseType;
  /** 운동 시간(분) */
  minutes: number;
  /** 운동에 쓰는 부위. restParts와 겹치면 안 된다. */
  targetParts: TargetPart[];
  /** 쉬어야 할 부위 = 근육통 4점 이상인 부위 (없으면 빈 목록) */
  restParts: SorenessPart[];
  /** 사용자에게 보여 줄 문구 */
  message: string;
}

/** 기복 예상 결과 (up=올라갈 가능성, similar=비슷, down=내려갈 가능성) */
export type TrendLabel = 'up' | 'similar' | 'down';
