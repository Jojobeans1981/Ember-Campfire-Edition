import type { UfliProgress } from '../types/UfliProgress';

const LESSON_XP = 100;
const ACTIVITY_XP = 50;
const CONNECTED_TEXT_XP = 75;

export const deriveXp = (ufliProgress: UfliProgress): number => {
  return Object.values(ufliProgress).reduce((total, lessonProgress) => {
    const completedActivities = Object.values(lessonProgress.activitiesComplete).filter(Boolean).length;

    return total
      + (lessonProgress.lessonComplete ? LESSON_XP : 0)
      + (completedActivities * ACTIVITY_XP)
      + (lessonProgress.connectedTextRead ? CONNECTED_TEXT_XP : 0);
  }, 0);
};

export const XpPolicy = {
  deriveXp
};
