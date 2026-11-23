// 기본 제안 문구(lib/domain/fallback.ts) 자동 테스트.
// Design Ref: §4.2 — 기본 문구는 시간 범위·사용 부위·쉬어야 할 부위 규칙을 항상 지킨다.
import { describe, expect, it } from 'vitest';
import {
  EXERCISE_TYPES,
  REST_ACTIVITY_MAX_MINUTES,
  SORENESS_PARTS,
  SORENESS_PART_LABELS,
  SUGGESTION_MINUTES_RANGE,
} from '../lib/domain/constants';
import { REST_LOCK_MESSAGE, getFallbackMinutes, getFallbackSuggestion } from '../lib/domain/fallback';
import type { ExerciseLevel, Intensity, SorenessPart } from '../lib/domain/types';

const LEVELS: ExerciseLevel[] = ['hobby', 'athlete'];
const INTENSITIES: Intensity[] = ['rest', 'light', 'moderate', 'high'];
const REST_PART_SAMPLES: SorenessPart[][] = [
  [],
  ['lower'],
  ['shoulder', 'back'],
  ['shoulder', 'back', 'arm', 'chest', 'abdomen'], // 5부위 (하체만 사용 가능)
  [...SORENESS_PARTS], // 6부위 전부
];
// 의학적 진단·치료를 말하면 안 되므로 문구에 이런 표현이 없는지 확인한다.
const BANNED_WORDS = ['진단', '치료', '처방', '질환', '병원'];

describe('getFallbackMinutes — 시간은 수준·강도별 범위 안', () => {
  it('정해진 기본 시간 (5분 단위, 범위의 가운데)', () => {
    expect(getFallbackMinutes('hobby', 'light')).toBe(25);
    expect(getFallbackMinutes('hobby', 'moderate')).toBe(40);
    expect(getFallbackMinutes('hobby', 'high')).toBe(55);
    expect(getFallbackMinutes('athlete', 'light')).toBe(40);
    expect(getFallbackMinutes('athlete', 'moderate')).toBe(60);
    expect(getFallbackMinutes('athlete', 'high')).toBe(100);
  });

  it('휴식은 스트레칭·산책 10분 이하', () => {
    expect(getFallbackMinutes('hobby', 'rest')).toBe(REST_ACTIVITY_MAX_MINUTES);
    expect(getFallbackMinutes('athlete', 'rest')).toBe(REST_ACTIVITY_MAX_MINUTES);
  });

  it('모든 수준·강도에서 허용 범위를 벗어나지 않는다', () => {
    for (const level of LEVELS) {
      for (const intensity of INTENSITIES) {
        const minutes = getFallbackMinutes(level, intensity);
        if (intensity === 'rest') {
          expect(minutes).toBeLessThanOrEqual(REST_ACTIVITY_MAX_MINUTES);
        } else {
          const { min, max } = SUGGESTION_MINUTES_RANGE[level][intensity];
          expect(minutes).toBeGreaterThanOrEqual(min);
          expect(minutes).toBeLessThanOrEqual(max);
        }
      }
    }
  });
});

describe('getFallbackSuggestion — 대표 사례', () => {
  it('아픈 곳이 없으면 전신 사용, 쉬어야 할 부위 없음', () => {
    const s = getFallbackSuggestion('hobby', 'light', []);
    expect(s).toEqual({
      type: 'cardio',
      minutes: 25,
      targetParts: ['whole'],
      restParts: [],
      message: '가볍게 유산소 25분을 추천해요.',
    });
  });

  it('하체를 쉬어야 하면 유산소 대신 근력 + 쉬지 않는 부위만 사용', () => {
    const s = getFallbackSuggestion('hobby', 'moderate', ['lower']);
    expect(s.type).toBe('strength');
    expect(s.minutes).toBe(40);
    expect(s.targetParts).toEqual(['shoulder', 'back', 'arm', 'chest', 'abdomen']);
    expect(s.restParts).toEqual(['lower']);
    expect(s.message).toBe(
      '적당한 강도로 근력 40분을 추천해요. 사용 부위: 어깨·등·팔·가슴·복부. 쉬어야 할 부위: 하체.',
    );
  });

  it('선수·높음 강도는 선수 시간 범위(75~120분) 안', () => {
    const s = getFallbackSuggestion('athlete', 'high', []);
    expect(s.type).toBe('strength');
    expect(s.minutes).toBe(100);
  });

  it('휴식 강도: 스트레칭·산책 10분 이내 안내', () => {
    const s = getFallbackSuggestion('hobby', 'rest', ['shoulder']);
    expect(s.type).toBe('recovery');
    expect(s.minutes).toBe(10);
    expect(s.message).toBe(
      '오늘은 쉬는 날이에요. 스트레칭이나 가벼운 산책을 10분 이내로만 하세요. 쉬어야 할 부위: 어깨.',
    );
  });

  it('6부위 모두 쉬어야 하면 기본 회복 안내 (사용 부위 없음)', () => {
    const s = getFallbackSuggestion('athlete', 'rest', [...SORENESS_PARTS]);
    expect(s).toEqual({
      type: 'recovery',
      minutes: 10,
      targetParts: [],
      restParts: [...SORENESS_PARTS],
      message: REST_LOCK_MESSAGE,
    });
    expect(REST_LOCK_MESSAGE).toBe('오늘은 쉬면서 가벼운 스트레칭과 충분한 수면·수분 섭취를 권해요');
  });

  it('쉬어야 할 부위 입력이 뒤섞이거나 중복돼도 화면 순서로 정리하고 원래 배열은 바꾸지 않는다', () => {
    const input: SorenessPart[] = ['lower', 'shoulder', 'lower'];
    const s = getFallbackSuggestion('hobby', 'light', input);
    expect(s.restParts).toEqual(['shoulder', 'lower']);
    expect(input).toEqual(['lower', 'shoulder', 'lower']);
  });

  it('같은 입력이면 항상 같은 결과', () => {
    const first = getFallbackSuggestion('athlete', 'moderate', ['back']);
    for (let i = 0; i < 100; i += 1) {
      expect(getFallbackSuggestion('athlete', 'moderate', ['back'])).toEqual(first);
    }
  });
});

describe('getFallbackSuggestion — 모든 조합에서 지켜져야 하는 규칙', () => {
  it('종류·시간·사용 부위·쉬어야 할 부위·문구 규칙을 항상 지킨다', () => {
    let count = 0;
    for (const level of LEVELS) {
      for (const intensity of INTENSITIES) {
        for (const restParts of REST_PART_SAMPLES) {
          const s = getFallbackSuggestion(level, intensity, restParts);

          // 허용된 운동 종류만
          expect(EXERCISE_TYPES).toContain(s.type);

          // 시간은 범위 안 (휴식·전부 쉬는 날은 10분 이하)
          if (intensity === 'rest' || restParts.length === SORENESS_PARTS.length) {
            expect(s.minutes).toBeLessThanOrEqual(REST_ACTIVITY_MAX_MINUTES);
          } else {
            const { min, max } = SUGGESTION_MINUTES_RANGE[level][intensity];
            expect(s.minutes).toBeGreaterThanOrEqual(min);
            expect(s.minutes).toBeLessThanOrEqual(max);
          }

          // 쉬어야 할 부위는 입력과 같고, 사용 부위와 겹치지 않는다
          expect(s.restParts).toEqual(SORENESS_PARTS.filter((p) => restParts.includes(p)));
          for (const part of s.restParts) expect(s.targetParts).not.toContain(part);

          // 전신(whole)은 쉬어야 할 부위가 없을 때만
          if (restParts.length === 0) {
            expect(s.targetParts).toEqual(['whole']);
          } else {
            expect(s.targetParts).not.toContain('whole');
          }

          // 문구: 비어 있지 않고, 진단·치료 표현이 없고, 쉬어야 할 부위 이름이 들어 있다
          expect(s.message.length).toBeGreaterThan(0);
          for (const word of BANNED_WORDS) expect(s.message).not.toContain(word);
          if (restParts.length > 0 && restParts.length < SORENESS_PARTS.length) {
            for (const part of restParts) expect(s.message).toContain(SORENESS_PART_LABELS[part]);
          }
          count += 1;
        }
      }
    }
    expect(count).toBe(LEVELS.length * INTENSITIES.length * REST_PART_SAMPLES.length);
  });
});
