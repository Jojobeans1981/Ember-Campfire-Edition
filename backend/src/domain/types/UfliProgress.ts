import type { LessonId } from '../value-objects/LessonId';

export const UFLI_ACTIVITY_TYPES = ['speech', 'match', 'blend', 'build', 'sentence'] as const;

export type UfliActivityType = (typeof UFLI_ACTIVITY_TYPES)[number];

export interface UfliLessonProgress {
  lessonComplete: boolean;
  activitiesComplete: Partial<Record<UfliActivityType, boolean>>;
  connectedTextRead: boolean;
}

export type UfliProgress = Record<LessonId, UfliLessonProgress>;
