import { describe, it, expect, beforeEach } from 'vitest';
import { useUfliProgression } from './useUfliProgression.js';
import { store } from '../store';

const ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'];

function resetStore() {
  store.xp = 0;
  store.activeLessonId = null;
  for (const k of Object.keys(store.ufliProgress)) {
    delete store.ufliProgress[k];
  }
}

describe('useUfliProgression', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('isUfliLessonUnlocked', () => {
    it('lesson 001 is unlocked by default', () => {
      const { isUfliLessonUnlocked } = useUfliProgression();
      expect(isUfliLessonUnlocked('001')).toBe(true);
    });

    it('lesson 002 is locked until lesson 001 is complete', () => {
      const { isUfliLessonUnlocked, completeUfliLesson } = useUfliProgression();
      expect(isUfliLessonUnlocked('002')).toBe(false);
      completeUfliLesson('001');
      expect(isUfliLessonUnlocked('002')).toBe(true);
    });

    it('lesson 003 is locked until lesson 002 is complete', () => {
      const { isUfliLessonUnlocked, completeUfliLesson } = useUfliProgression();
      completeUfliLesson('001');
      expect(isUfliLessonUnlocked('003')).toBe(false);
      completeUfliLesson('002');
      expect(isUfliLessonUnlocked('003')).toBe(true);
    });

    it('returns false for unknown lesson ids', () => {
      const { isUfliLessonUnlocked } = useUfliProgression();
      expect(isUfliLessonUnlocked('999')).toBe(false);
    });
  });

  describe('getUfliLessonStatus', () => {
    it('lesson 001 starts as kindling (unlocked, lesson incomplete)', () => {
      const { getUfliLessonStatus } = useUfliProgression();
      expect(getUfliLessonStatus('001')).toBe('kindling');
    });

    it('locked lessons return locked', () => {
      const { getUfliLessonStatus } = useUfliProgression();
      expect(getUfliLessonStatus('002')).toBe('locked');
    });

    it('after completing a lesson, status becomes sparks', () => {
      const { getUfliLessonStatus, completeUfliLesson } = useUfliProgression();
      completeUfliLesson('001');
      expect(getUfliLessonStatus('001')).toBe('sparks');
    });

    it('after all 5 activities, status becomes fire', () => {
      const { getUfliLessonStatus, completeUfliLesson, completeUfliActivity } = useUfliProgression();
      completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) completeUfliActivity('001', t);
      expect(getUfliLessonStatus('001')).toBe('fire');
    });

    it('after connected text read, status becomes complete', () => {
      const {
        getUfliLessonStatus,
        completeUfliLesson,
        completeUfliActivity,
        completeUfliConnectedText,
      } = useUfliProgression();
      completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) completeUfliActivity('001', t);
      completeUfliConnectedText('001');
      expect(getUfliLessonStatus('001')).toBe('complete');
    });
  });

  describe('completeUfliLesson', () => {
    it('marks lessonComplete true and awards +100 XP', () => {
      const { completeUfliLesson } = useUfliProgression();
      completeUfliLesson('001');
      expect(store.ufliProgress['001'].lessonComplete).toBe(true);
      expect(store.xp).toBe(100);
    });

    it('does not double-award XP if called twice', () => {
      const { completeUfliLesson } = useUfliProgression();
      completeUfliLesson('001');
      completeUfliLesson('001');
      expect(store.xp).toBe(100);
    });

    it('initializes activitiesComplete with all five flags false', () => {
      const { completeUfliLesson } = useUfliProgression();
      completeUfliLesson('001');
      const ac = store.ufliProgress['001'].activitiesComplete;
      for (const t of ACTIVITY_TYPES) {
        expect(ac).toHaveProperty(t, false);
      }
    });
  });

  describe('completeUfliActivity', () => {
    it('is locked until lesson is complete', () => {
      const { completeUfliActivity } = useUfliProgression();
      completeUfliActivity('001', 'speech');
      expect(store.xp).toBe(0);
      expect(store.ufliProgress['001']?.activitiesComplete?.speech).not.toBe(true);
    });

    it('awards +50 XP and marks the flag once unlocked', () => {
      const { completeUfliLesson, completeUfliActivity } = useUfliProgression();
      completeUfliLesson('001');
      completeUfliActivity('001', 'speech');
      expect(store.ufliProgress['001'].activitiesComplete.speech).toBe(true);
      expect(store.xp).toBe(150);
    });

    it('does not double-award XP for the same activity', () => {
      const { completeUfliLesson, completeUfliActivity } = useUfliProgression();
      completeUfliLesson('001');
      completeUfliActivity('001', 'speech');
      completeUfliActivity('001', 'speech');
      expect(store.xp).toBe(150);
    });
  });

  describe('completeUfliConnectedText', () => {
    it('is locked until all 5 activities are complete', () => {
      const { completeUfliLesson, completeUfliConnectedText } = useUfliProgression();
      completeUfliLesson('001');
      completeUfliConnectedText('001');
      expect(store.ufliProgress['001'].connectedTextRead).not.toBe(true);
      expect(store.xp).toBe(100);
    });

    it('awards +75 XP and unlocks the next lesson once complete', () => {
      const {
        completeUfliLesson,
        completeUfliActivity,
        completeUfliConnectedText,
        isUfliLessonUnlocked,
      } = useUfliProgression();
      completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) completeUfliActivity('001', t);
      completeUfliConnectedText('001');
      expect(store.ufliProgress['001'].connectedTextRead).toBe(true);
      expect(store.xp).toBe(100 + 50 * 5 + 75);
      expect(isUfliLessonUnlocked('002')).toBe(true);
    });
  });

  describe('getCumulativeLearnedLessonIds', () => {
    it('returns lessons with lessonComplete: true in canonical order', () => {
      const { completeUfliLesson, getCumulativeLearnedLessonIds } = useUfliProgression();
      completeUfliLesson('002');
      completeUfliLesson('001');
      completeUfliLesson('004');
      const ids = getCumulativeLearnedLessonIds();
      expect(ids).toEqual(['001', '002', '004']);
    });

    it('returns empty array initially', () => {
      const { getCumulativeLearnedLessonIds } = useUfliProgression();
      expect(getCumulativeLearnedLessonIds()).toEqual([]);
    });
  });
});
