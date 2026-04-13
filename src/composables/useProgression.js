import { store } from '../store';
import { UNITS } from '../data/curriculum.js';

const ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'];

export function useProgression() {

  function ensureUnitProgress(unitId) {
    if (!store.unitProgress[unitId]) {
      const activities = {};
      ACTIVITY_TYPES.forEach(t => { activities[t] = false; });
      store.unitProgress[unitId] = {
        lessonComplete: false,
        activitiesComplete: activities,
        storyRead: false,
      };
    }
    return store.unitProgress[unitId];
  }

  function getUnitStatus(unitId) {
    const unit = UNITS.find(u => u.unitId === unitId);
    if (!unit) return 'locked';

    // Check prerequisite
    if (unit.prerequisiteUnit) {
      const prereqStatus = getUnitStatus(unit.prerequisiteUnit);
      if (prereqStatus === 'locked' || prereqStatus === 'kindling') {
        return 'locked';
      }
    }

    const progress = store.unitProgress[unitId];
    if (!progress || !progress.lessonComplete) return 'kindling';

    const activitiesDone = Object.values(progress.activitiesComplete || {}).filter(Boolean).length;
    const totalActivities = ACTIVITY_TYPES.length;

    if (activitiesDone < totalActivities) return 'sparks';
    if (!progress.storyRead) return 'fire';
    return 'stories';
  }

  function getLearnedPhonemes() {
    const phonemes = [];
    for (const unit of UNITS) {
      const status = getUnitStatus(unit.unitId);
      if (status !== 'locked' && status !== 'kindling') {
        phonemes.push(...unit.phonemes);
      } else if (status === 'kindling') {
        // Include phonemes from units where lesson is available (even if not complete)
        // so the lesson can teach them
        phonemes.push(...unit.phonemes);
        break;
      }
    }
    return phonemes;
  }

  function getPhonemesForUnit(unitId) {
    const phonemes = [];
    for (const unit of UNITS) {
      phonemes.push(...unit.phonemes);
      if (unit.unitId === unitId) break;
    }
    return phonemes;
  }

  function completeLesson(unitId) {
    const progress = ensureUnitProgress(unitId);
    progress.lessonComplete = true;
    store.xp += 100;
  }

  function completeActivity(unitId, activityType) {
    const progress = ensureUnitProgress(unitId);
    if (!progress.activitiesComplete[activityType]) {
      progress.activitiesComplete[activityType] = true;
      store.xp += 50;
    }
  }

  function completeStory(unitId) {
    const progress = ensureUnitProgress(unitId);
    if (!progress.storyRead) {
      progress.storyRead = true;
      store.xp += 75;
    }
  }

  function isActivityUnlocked(unitId, activityType) {
    const progress = store.unitProgress[unitId];
    if (!progress || !progress.lessonComplete) return false;
    return true;
  }

  function isStoryUnlocked(unitId) {
    const progress = store.unitProgress[unitId];
    if (!progress || !progress.lessonComplete) return false;
    return Object.values(progress.activitiesComplete).every(Boolean);
  }

  function getCurrentUnit() {
    for (const unit of UNITS) {
      const status = getUnitStatus(unit.unitId);
      if (status !== 'stories') return unit;
    }
    return UNITS[UNITS.length - 1];
  }

  return {
    getUnitStatus,
    getLearnedPhonemes,
    getPhonemesForUnit,
    completeLesson,
    completeActivity,
    completeStory,
    isActivityUnlocked,
    isStoryUnlocked,
    getCurrentUnit,
    ensureUnitProgress,
    ACTIVITY_TYPES,
  };
}
