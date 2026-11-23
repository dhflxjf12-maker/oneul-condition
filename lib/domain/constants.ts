// 점수·강도·제안·한도에 쓰는 규칙 상수를 한 곳에 모은 파일.
// Design Ref: §10 — 환산표·비중·구간·시간 범위·한도 숫자는 이 파일에만 두고, 바꿀 때 여기만 고친다.
// Plan SC: 환산값과 비중은 처음 정한 값이라 출시 후 조정할 수 있어야 한다. (작업 1번)
import type {
  ExerciseLevel,
  ExerciseType,
  Intensity,
  SorenessPart,
} from './types';

// ---------------------------------------------------------------------------
// 1. 체크인 6개 항목과 입력 선택지
// ---------------------------------------------------------------------------

/** 체크인 6개 항목의 이름 (화면 순서와 같음) */
export const CHECKIN_ITEM_KEYS = [
  'sleepBand',
  'sleepQuality',
  'fatigue',
  'soreness',
  'mood',
  'yesterdayLoad',
] as const;

/** 화면에 보여 줄 항목 이름 */
export const CHECKIN_ITEM_LABELS = {
  sleepBand: '수면 시간',
  sleepQuality: '수면의 질',
  fatigue: '피로도',
  soreness: '근육통',
  mood: '기분',
  yesterdayLoad: '어제 운동량',
} as const satisfies Record<(typeof CHECKIN_ITEM_KEYS)[number], string>;

/** 수면 시간 5구간 이름 (순서 = 1~5단계) */
export const SLEEP_BAND_LABELS = [
  '5시간 미만',
  '5~6시간 미만',
  '6~7시간 미만',
  '7~9시간',
  '9시간 초과',
] as const;

/** 1~5 단계 항목의 양 끝 설명 (1단계 / 5단계) */
export const RATING_ENDPOINT_LABELS = {
  sleepQuality: { low: '매우 나쁨', high: '매우 좋음' },
  fatigue: { low: '거의 없음', high: '매우 심함' },
  mood: { low: '매우 나쁨', high: '매우 좋음' },
} as const;

/** 어제 운동량 5단계 이름과 설명 (순서 = 1~5단계) */
export const YESTERDAY_LOAD_OPTIONS = [
  { label: '쉬었음', description: '운동하지 않았어요' },
  { label: '가벼움', description: '30분 미만이거나 산책 수준' },
  { label: '보통', description: '30~60분' },
  { label: '강함', description: '60~90분이거나 숨이 많이 찬 운동' },
  { label: '매우 강함', description: '90분 이상이거나 한계까지' },
] as const;

/** 근육통을 입력하는 6부위 (화면 순서) */
export const SORENESS_PARTS = [
  'shoulder',
  'back',
  'arm',
  'chest',
  'abdomen',
  'lower',
] as const satisfies readonly SorenessPart[];

/** 근육통 부위 이름 */
export const SORENESS_PART_LABELS = {
  shoulder: '어깨',
  back: '등',
  arm: '팔',
  chest: '가슴',
  abdomen: '복부',
  lower: '하체',
} as const satisfies Record<SorenessPart, string>;

/** 근육통 한 부위의 점수 범위 (0 = 없음) */
export const SORENESS_MIN_POINT = 0;
export const SORENESS_MAX_POINT = 5;

/** 운동 수준 이름 */
export const LEVEL_LABELS = {
  hobby: '애호가',
  athlete: '선수',
} as const satisfies Record<ExerciseLevel, string>;

// ---------------------------------------------------------------------------
// 2. 점수 계산: 환산표와 비중
// ---------------------------------------------------------------------------

/** 점수 범위 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/**
 * 항목별 비중(정수 %). 합계는 반드시 100이다.
 * Design Ref: §10 — 소수(0.15 등)로 곱하면 계산 오차가 생기므로 정수 %로만 다룬다.
 */
export const ITEM_WEIGHT_PERCENT = {
  sleepBand: 20,
  sleepQuality: 15,
  fatigue: 20,
  soreness: 15,
  mood: 10,
  yesterdayLoad: 20,
} as const satisfies Record<(typeof CHECKIN_ITEM_KEYS)[number], number>;

// 항목 점수(0~100) 환산표. 배열 순서 = 1~5단계 (단계 − 1 이 위치)
/** 수면 시간: 5시간 미만 0 / 5~6 30 / 6~7 60 / 7~9 100 / 9시간 초과 80 */
export const SLEEP_BAND_SCORES = [0, 30, 60, 100, 80] as const;
/** 수면의 질: 1→0, 2→25, 3→50, 4→75, 5→100 */
export const SLEEP_QUALITY_SCORES = [0, 25, 50, 75, 100] as const;
/** 피로도: 1→100, 2→75, 3→50, 4→25, 5→0 */
export const FATIGUE_SCORES = [100, 75, 50, 25, 0] as const;
/** 기분: 1→0, 2→25, 3→50, 4→75, 5→100 */
export const MOOD_SCORES = [0, 25, 50, 75, 100] as const;
/** 어제 운동량: 쉬었음 100 / 가벼움 90 / 보통 70 / 강함 40 / 매우 강함 0 */
export const YESTERDAY_LOAD_SCORES = [100, 90, 70, 40, 0] as const;

/** 근육통 항목 점수 = 100 − (가장 높은 부위 점수 × 이 값) */
export const SORENESS_SCORE_PER_POINT = 20;

// ---------------------------------------------------------------------------
// 3. 강도 결정: 구간, 상한, 고정 규칙
// ---------------------------------------------------------------------------

/** 강도 단계 순서 (낮은 것부터) */
export const INTENSITY_ORDER = ['rest', 'light', 'moderate', 'high'] as const satisfies readonly Intensity[];

/** 강도 이름 */
export const INTENSITY_LABELS = {
  rest: '휴식',
  light: '가벼움',
  moderate: '보통',
  high: '높음',
} as const satisfies Record<Intensity, string>;

/** 강도별 점수 시작값: 0~39 휴식, 40~59 가벼움, 60~79 보통, 80~100 높음 */
export const INTENSITY_MIN_SCORE = {
  rest: 0,
  light: 40,
  moderate: 60,
  high: 80,
} as const satisfies Record<Intensity, number>;

/** 이 점수 미만이면 "휴식 권장" 문구를 함께 보여 준다 */
export const REST_RECOMMENDED_BELOW_SCORE = 40;

/** 상한 규칙: 수면 시간이 이 구간 이하(1 = 5시간 미만)이면 강도는 CAP_INTENSITY를 넘지 않는다 */
export const SLEEP_CAP_MAX_BAND = 1;
/** 상한 규칙: 근육통이 이 점수인 부위가 하나라도 있으면 강도는 CAP_INTENSITY를 넘지 않는다 */
export const SORENESS_CAP_POINT = 5;
/** 상한 규칙이 적용될 때 넘을 수 없는 강도 ("보통") */
export const CAP_INTENSITY: Intensity = 'moderate';

/** 근육통이 이 점수 이상인 부위는 제안에서 제외하고 "쉬어야 할 부위"로 표시한다 */
export const SORENESS_EXCLUDE_POINT = 4;
/** 6부위가 모두 이 점수 이상이면 강도를 "휴식"으로 고정하고 AI를 쓰지 않는다 */
export const SORENESS_REST_LOCK_POINT = 4;

// ---------------------------------------------------------------------------
// 4. 제안: 운동 종류와 수준별 시간 범위
// ---------------------------------------------------------------------------

/** 제안할 수 있는 운동 종류 (이 세 가지 외에는 거부) */
export const EXERCISE_TYPES = ['cardio', 'strength', 'recovery'] as const satisfies readonly ExerciseType[];

/** 운동 종류 이름 */
export const EXERCISE_TYPE_LABELS = {
  cardio: '유산소',
  strength: '근력',
  recovery: '스트레칭·회복',
} as const satisfies Record<ExerciseType, string>;

/** 운동 수준·강도별 제안 시간 범위(분). 휴식은 운동 없음이라 따로 정한다. */
export const SUGGESTION_MINUTES_RANGE = {
  hobby: {
    light: { min: 20, max: 30 },
    moderate: { min: 30, max: 45 },
    high: { min: 45, max: 60 },
  },
  athlete: {
    light: { min: 30, max: 45 },
    moderate: { min: 45, max: 75 },
    high: { min: 75, max: 120 },
  },
} as const satisfies Record<ExerciseLevel, Record<Exclude<Intensity, 'rest'>, { min: number; max: number }>>;

/** 휴식일 때 스트레칭·산책 시간 상한(분) */
export const REST_ACTIVITY_MAX_MINUTES = 10;

// ---------------------------------------------------------------------------
// 5. 한도·시간 제한·로그인 규칙 숫자
// ---------------------------------------------------------------------------

/** 하루 AI 제안 호출 한도 (사용자 또는 기기 단위) */
export const MAX_AI_CALLS_PER_DAY = 20;
/** 서버가 AI 응답을 기다리는 최대 시간(ms). 화면 기준 5초 안에 끝나도록 4초로 둔다. */
export const AI_SERVER_TIMEOUT_MS = 4000;
/** 화면이 제안을 기다리는 최대 시간(ms). 넘으면 기본 문구로 바꾼다. */
export const SUGGESTION_UI_TIMEOUT_MS = 5000;
/** 제안이 화면에 이 시간(ms) 이상 보이면 "표시됨"으로 기록한다 */
export const SUGGESTION_VIEWED_MS = 3000;

/** 비밀번호 최소 길이 */
export const PASSWORD_MIN_LENGTH = 8;
/** 연속 로그인 실패 몇 번째에 잠그는지 */
export const MAX_LOGIN_FAILURES = 5;
/** 잠금 시간(분) */
export const LOGIN_LOCK_MINUTES = 10;
/** 마지막 실패로부터 이 시간(시)이 지나면 실패 횟수를 0으로 되돌린다 */
export const LOGIN_FAILURE_RESET_HOURS = 24;
/** 로그인 유지 기간(일) */
export const SESSION_DAYS = 30;
/** 가입할 수 있는 최소 나이(만) */
export const MIN_SIGNUP_AGE = 14;

/** 로그인 시도 기록 보관 기간(일, 잠금이 풀린 뒤부터) */
export const LOGIN_ATTEMPT_RETENTION_DAYS = 1;
/** AI 호출 횟수 기록 보관 기간(일) */
export const AI_CALLS_RETENTION_DAYS = 7;

// ---------------------------------------------------------------------------
// 6. 기복 예상 (정수로만 계산)
// ---------------------------------------------------------------------------

/** 오늘을 포함한 최근 며칠 안의 기록만 센다 */
export const TREND_WINDOW_DAYS = 14;
/** 이 개수 이상의 기록이 있어야 예상을 보여 준다 */
export const TREND_MIN_RECORDS = 7;
/** 최근 기록 몇 개의 합을 "최근"으로 볼지 */
export const TREND_RECENT_COUNT = 3;
/** 최근 기록 몇 개의 합을 "기준"으로 볼지 */
export const TREND_BASE_COUNT = 7;
/**
 * 합계 차이 기준값.
 * 차이 = (최근 3개 점수 합 × 7) − (최근 7개 점수 합 × 3) = 평균 차이 × 21.
 * +105 이상이면 "올라갈 가능성", −105 이하이면 "내려갈 가능성", 그 사이면 "비슷" (평균 차이 ±5와 같은 뜻)
 */
export const TREND_DIFF_THRESHOLD = 105;
