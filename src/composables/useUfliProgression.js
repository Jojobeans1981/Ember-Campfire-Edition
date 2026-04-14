import { store } from '../store';
import { ALL_UFLI_LESSON_IDS, lessonIdFromNumber } from '../data/ufli/ufliLessons.js';

const ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'];

const XP_LESSON = 100;
const XP_ACTIVITY = 50;
const XP_CONNECTED_TEXT = 75;

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

  function completeUfliLesson(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    const p = ensureProgress(id);
    if (p.lessonComplete) return;
    p.lessonComplete = true;
    store.xp += XP_LESSON;
  }

  function completeUfliActivity(lessonId, activityType) {
    const id = lessonIdFromNumber(lessonId);
    const p = store.ufliProgress[id];
    if (!p || !p.lessonComplete) return;
    if (!ACTIVITY_TYPES.includes(activityType)) return;
    if (p.activitiesComplete[activityType]) return;
    p.activitiesComplete[activityType] = true;
    store.xp += XP_ACTIVITY;
  }

  function completeUfliConnectedText(lessonId) {
    const id = lessonIdFromNumber(lessonId);
    const p = store.ufliProgress[id];
    if (!p || !p.lessonComplete) return;
    if (!activitiesAllComplete(p)) return;
    if (p.connectedTextRead) return;
    p.connectedTextRead = true;
    store.xp += XP_CONNECTED_TEXT;
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
