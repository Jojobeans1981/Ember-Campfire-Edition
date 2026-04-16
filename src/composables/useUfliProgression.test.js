import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./useProfileProgress.js', async () => {
  const { store } = await import('../store');

  function ensureProgress(lessonId) {
    if (!store.ufliProgress[lessonId]) {
      store.ufliProgress[lessonId] = {
        lessonComplete: false,
        activitiesComplete: {
          speech: false,
          match: false,
          blend: false,
          build: false,
          sentence: false,
        },
        connectedTextRead: false,
      };
    }

    return store.ufliProgress[lessonId];
  }

  return {
    useProfileProgress: () => ({
      submitOperation: vi.fn(async (type, payload) => {
        switch (type) {
          case 'complete_lesson':
            ensureProgress(payload.lessonId).lessonComplete = true;
            store.xp += 100;
            break;
          case 'complete_activity':
            ensureProgress(payload.lessonId).activitiesComplete[payload.activityType] = true;
            store.xp += 50;
            break;
          case 'complete_connected_text':
            ensureProgress(payload.lessonId).connectedTextRead = true;
            store.xp += 75;
            break;
          default:
            break;
        }
      }),
    }),
  };
});

import { store, clearBootstrapState } from '../store';
import { useUfliProgression } from './useUfliProgression.js';

const ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'];

function resetStore() {
  clearBootstrapState();
  store.activeProfileId = 'profile-1';
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

    it('lesson 002 is locked until lesson 001 is complete', async () => {
      const { isUfliLessonUnlocked, completeUfliLesson } = useUfliProgression();
      expect(isUfliLessonUnlocked('002')).toBe(false);
      await completeUfliLesson('001');
      expect(isUfliLessonUnlocked('002')).toBe(true);
    });

    it('lesson 003 is locked until lesson 002 is complete', async () => {
      const { isUfliLessonUnlocked, completeUfliLesson } = useUfliProgression();
      await completeUfliLesson('001');
      expect(isUfliLessonUnlocked('003')).toBe(false);
      await completeUfliLesson('002');
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

    it('after completing a lesson, status becomes sparks', async () => {
      const { getUfliLessonStatus, completeUfliLesson } = useUfliProgression();
      await completeUfliLesson('001');
      expect(getUfliLessonStatus('001')).toBe('sparks');
    });

    it('after all 5 activities, status becomes fire', async () => {
      const { getUfliLessonStatus, completeUfliLesson, completeUfliActivity } = useUfliProgression();
      await completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) {
        await completeUfliActivity('001', t);
      }
      expect(getUfliLessonStatus('001')).toBe('fire');
    });

    it('after connected text read, status becomes complete', async () => {
      const {
        getUfliLessonStatus,
        completeUfliLesson,
        completeUfliActivity,
        completeUfliConnectedText,
      } = useUfliProgression();
      await completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) {
        await completeUfliActivity('001', t);
      }
      await completeUfliConnectedText('001');
      expect(getUfliLessonStatus('001')).toBe('complete');
    });
  });

  describe('completeUfliLesson', () => {
    it('marks lessonComplete true and awards +100 XP', async () => {
      const { completeUfliLesson } = useUfliProgression();
      await completeUfliLesson('001');
      expect(store.ufliProgress['001'].lessonComplete).toBe(true);
      expect(store.xp).toBe(100);
    });

    it('does not double-award XP if called twice', async () => {
      const { completeUfliLesson } = useUfliProgression();
      await completeUfliLesson('001');
      await completeUfliLesson('001');
      expect(store.xp).toBe(100);
    });

    it('initializes activitiesComplete with all five flags false', async () => {
      const { completeUfliLesson } = useUfliProgression();
      await completeUfliLesson('001');
      const ac = store.ufliProgress['001'].activitiesComplete;
      for (const t of ACTIVITY_TYPES) {
        expect(ac).toHaveProperty(t, false);
      }
    });
  });

  describe('completeUfliActivity', () => {
    it('is locked until lesson is complete', async () => {
      const { completeUfliActivity } = useUfliProgression();
      await completeUfliActivity('001', 'speech');
      expect(store.xp).toBe(0);
      expect(store.ufliProgress['001']?.activitiesComplete?.speech).not.toBe(true);
    });

    it('awards +50 XP and marks the flag once unlocked', async () => {
      const { completeUfliLesson, completeUfliActivity } = useUfliProgression();
      await completeUfliLesson('001');
      await completeUfliActivity('001', 'speech');
      expect(store.ufliProgress['001'].activitiesComplete.speech).toBe(true);
      expect(store.xp).toBe(150);
    });

    it('does not double-award XP for the same activity', async () => {
      const { completeUfliLesson, completeUfliActivity } = useUfliProgression();
      await completeUfliLesson('001');
      await completeUfliActivity('001', 'speech');
      await completeUfliActivity('001', 'speech');
      expect(store.xp).toBe(150);
    });
  });

  describe('completeUfliConnectedText', () => {
    it('is locked until all 5 activities are complete', async () => {
      const { completeUfliLesson, completeUfliConnectedText } = useUfliProgression();
      await completeUfliLesson('001');
      await completeUfliConnectedText('001');
      expect(store.ufliProgress['001'].connectedTextRead).not.toBe(true);
      expect(store.xp).toBe(100);
    });

    it('awards +75 XP and unlocks the next lesson once complete', async () => {
      const {
        completeUfliLesson,
        completeUfliActivity,
        completeUfliConnectedText,
        isUfliLessonUnlocked,
      } = useUfliProgression();
      await completeUfliLesson('001');
      for (const t of ACTIVITY_TYPES) {
        await completeUfliActivity('001', t);
      }
      await completeUfliConnectedText('001');
      expect(store.ufliProgress['001'].connectedTextRead).toBe(true);
      expect(store.xp).toBe(100 + 50 * 5 + 75);
      expect(isUfliLessonUnlocked('002')).toBe(true);
    });
  });

  describe('getCumulativeLearnedLessonIds', () => {
    it('returns lessons with lessonComplete: true in canonical order', async () => {
      const { completeUfliLesson, getCumulativeLearnedLessonIds } = useUfliProgression();
      await completeUfliLesson('002');
      await completeUfliLesson('001');
      await completeUfliLesson('004');
      const ids = getCumulativeLearnedLessonIds();
      expect(ids).toEqual(['001', '002', '004']);
    });

    it('returns empty array initially', () => {
      const { getCumulativeLearnedLessonIds } = useUfliProgression();
      expect(getCumulativeLearnedLessonIds()).toEqual([]);
    });
  });
});
