import { store } from '../store';
import { ALL_UFLI_LESSON_IDS, lessonIdFromNumber } from '../data/ufli/ufliLessons.js';
import { useProfileProgress } from './useProfileProgress.js';

const ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'];

function makeEmptyProgress() {
  const activitiesComplete = {};
  for (const t of ACTIVITY_TYPES) activitiesComplete[t] = false;
  return {
    lessonComplete: false,
    activitiesComplete,
    connectedTextRead: false,
  };
}

function ensureProgress(id) {
  if (!store.ufliProgress[id]) {
    store.ufliProgress[id] = makeEmptyProgress();
  }
  return store.ufliProgress[id];
}

function activitiesAllComplete(progress) {
  return ACTIVITY_TYPES.every((t) => progress.activitiesComplete[t]);
}

export function useUfliProgression() {
  const { submitOperation } = useProfileProgress();

  function isUfliLessonUnlocked(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    const idx = ALL_UFLI_LESSON_IDS.indexOf(id);
    if (idx < 0) return false;
    if (idx === 0) return true;
    const prev = ALL_UFLI_LESSON_IDS[idx - 1];
    return store.ufliProgress[prev]?.lessonComplete === true;
  }

  function getUfliLessonStatus(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    if (!isUfliLessonUnlocked(id)) return 'locked';
    const p = store.ufliProgress[id];
    if (!p || !p.lessonComplete) return 'kindling';
    if (!activitiesAllComplete(p)) return 'sparks';
    if (!p.connectedTextRead) return 'fire';
    return 'complete';
  }

  async function completeUfliLesson(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    const p = ensureProgress(id);
    if (p.lessonComplete) return;
    await submitOperation('complete_lesson', { lessonId: id });
  }

  async function completeUfliActivity(lessonId, activityType) {
    const id = lessonIdFromNumber(lessonId);
    const p = store.ufliProgress[id];
    if (!p || !p.lessonComplete) return;
    if (!ACTIVITY_TYPES.includes(activityType)) return;
    if (p.activitiesComplete[activityType]) return;
    await submitOperation('complete_activity', { lessonId: id, activityType });
  }

  async function completeUfliConnectedText(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    const p = store.ufliProgress[id];
    if (!p || !p.lessonComplete) return;
    if (!activitiesAllComplete(p)) return;
    if (p.connectedTextRead) return;
    await submitOperation('complete_connected_text', { lessonId: id });
  }

  function getCumulativeLearnedLessonIds() {
    return ALL_UFLI_LESSON_IDS.filter((id) => store.ufliProgress[id]?.lessonComplete === true);
  }

  return {
    ACTIVITY_TYPES,
    isUfliLessonUnlocked,
    getUfliLessonStatus,
    completeUfliLesson,
    completeUfliActivity,
    completeUfliConnectedText,
    getCumulativeLearnedLessonIds,
  };
}
