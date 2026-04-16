import type { ProfileProgress } from '../models/ProfileProgress';
import type {
  ProgressOperation,
  ProgressOperationRejectionCode
} from '../models/ProgressOperation';
import {
  UFLI_ACTIVITY_TYPES,
  type UfliLessonProgress,
  type UfliProgress
} from '../types/UfliProgress';
import { deriveXp } from './XpPolicy';

export interface AppliedProgressOperationResult {
  clientOperationId: string;
  appliedVersion: number;
}

export interface RejectedProgressOperationResult {
  clientOperationId: string;
  code: ProgressOperationRejectionCode;
  message: string;
}

export interface ApplyProgressOperationsResult {
  startingVersion: number;
  endingVersion: number;
  applied: AppliedProgressOperationResult[];
  rejected: RejectedProgressOperationResult[];
  snapshot: ProfileProgress;
}

const createDefaultLessonProgress = (): UfliLessonProgress => ({
  lessonComplete: false,
  activitiesComplete: {},
  connectedTextRead: false
});

const cloneUfliProgress = (ufliProgress: UfliProgress): UfliProgress => {
  const entries = Object.entries(ufliProgress).map(([lessonId, lessonProgress]) => [
    lessonId,
    {
      lessonComplete: lessonProgress.lessonComplete,
      activitiesComplete: { ...lessonProgress.activitiesComplete },
      connectedTextRead: lessonProgress.connectedTextRead
    }
  ]);

  return Object.fromEntries(entries);
};

const isSafeAutoRebaseOperation = (operation: ProgressOperation): boolean => {
  return operation.type !== 'replace_skill_state';
};

const rejectOperation = (
  operation: ProgressOperation,
  code: ProgressOperationRejectionCode,
  message: string
): RejectedProgressOperationResult => ({
  clientOperationId: operation.clientOperationId,
  code,
  message
});

const getLessonProgress = (ufliProgress: UfliProgress, lessonId: string): UfliLessonProgress => {
  return ufliProgress[lessonId] ?? createDefaultLessonProgress();
};

const hasExistingLessonProgress = (ufliProgress: UfliProgress, lessonId: string): boolean => {
  return lessonId in ufliProgress;
};

const areAllActivitiesComplete = (lessonProgress: UfliLessonProgress): boolean => {
  return UFLI_ACTIVITY_TYPES.every((activityType) => lessonProgress.activitiesComplete[activityType] === true);
};

const validateOperation = (
  snapshot: ProfileProgress,
  operation: ProgressOperation
): RejectedProgressOperationResult | null => {
  switch (operation.type) {
    case 'complete_activity': {
      if (!hasExistingLessonProgress(snapshot.ufliProgress, operation.payload.lessonId)) {
        return rejectOperation(
          operation,
          'invalid',
          'Activity completion requires an existing lesson progress record.'
        );
      }

      const lessonProgress = snapshot.ufliProgress[operation.payload.lessonId];

      if (!lessonProgress.lessonComplete) {
        return rejectOperation(
          operation,
          'invalid',
          'Activity completion requires the lesson to be complete.'
        );
      }

      return null;
    }

    case 'complete_connected_text': {
      if (!hasExistingLessonProgress(snapshot.ufliProgress, operation.payload.lessonId)) {
        return rejectOperation(
          operation,
          'invalid',
          'Connected text completion requires an existing lesson progress record.'
        );
      }

      const lessonProgress = snapshot.ufliProgress[operation.payload.lessonId];

      if (!lessonProgress.lessonComplete) {
        return rejectOperation(
          operation,
          'invalid',
          'Connected text completion requires the lesson to be complete.'
        );
      }

      if (!areAllActivitiesComplete(lessonProgress)) {
        return rejectOperation(
          operation,
          'invalid',
          'Connected text completion requires all lesson activities to be complete.'
        );
      }

      return null;
    }

    default:
      return null;
  }
};

const applyOperation = (snapshot: ProfileProgress, operation: ProgressOperation): ProfileProgress => {
  switch (operation.type) {
    case 'complete_lesson': {
      const lessonProgress = getLessonProgress(snapshot.ufliProgress, operation.payload.lessonId);

      return {
        ...snapshot,
        ufliProgress: {
          ...snapshot.ufliProgress,
          [operation.payload.lessonId]: {
            ...lessonProgress,
            lessonComplete: lessonProgress.lessonComplete || true
          }
        }
      };
    }

    case 'complete_activity': {
      const lessonProgress = getLessonProgress(snapshot.ufliProgress, operation.payload.lessonId);

      return {
        ...snapshot,
        ufliProgress: {
          ...snapshot.ufliProgress,
          [operation.payload.lessonId]: {
            ...lessonProgress,
            activitiesComplete: {
              ...lessonProgress.activitiesComplete,
              [operation.payload.activityType]: lessonProgress.activitiesComplete[operation.payload.activityType] || true
            }
          }
        }
      };
    }

    case 'complete_connected_text': {
      const lessonProgress = getLessonProgress(snapshot.ufliProgress, operation.payload.lessonId);

      return {
        ...snapshot,
        ufliProgress: {
          ...snapshot.ufliProgress,
          [operation.payload.lessonId]: {
            ...lessonProgress,
            connectedTextRead: lessonProgress.connectedTextRead || true
          }
        }
      };
    }

    case 'set_selected_friend':
      return {
        ...snapshot,
        selectedFriend: operation.payload.selectedFriend
      };

    case 'replace_skill_state':
      return {
        ...snapshot,
        skillState: { ...operation.payload.skillState },
        skillStateSchemaVersion: operation.payload.skillStateSchemaVersion
      };
  }
};

export const applyProgressOperations = (
  snapshot: ProfileProgress,
  operations: ProgressOperation[],
  updatedAt: Date
): ApplyProgressOperationsResult => {
  const startingVersion = snapshot.version;
  const isStaleBatch = operations.some((operation) => operation.baseVersion !== startingVersion);
  let nextSnapshot: ProfileProgress = {
    ...snapshot,
    ufliProgress: cloneUfliProgress(snapshot.ufliProgress),
    skillState: { ...snapshot.skillState }
  };

  const appliedClientOperationIds: string[] = [];
  const rejected: RejectedProgressOperationResult[] = [];

  for (const operation of operations) {
    if (isStaleBatch && !isSafeAutoRebaseOperation(operation)) {
      rejected.push(rejectOperation(
        operation,
        'conflict',
        'Operation is stale against newer server skill state.'
      ));
      continue;
    }

    const validationError = validateOperation(nextSnapshot, operation);
    if (validationError) {
      rejected.push(validationError);
      continue;
    }

    nextSnapshot = applyOperation(nextSnapshot, operation);
    appliedClientOperationIds.push(operation.clientOperationId);
  }

  const endingVersion = appliedClientOperationIds.length > 0 ? startingVersion + 1 : startingVersion;

  nextSnapshot = {
    ...nextSnapshot,
    version: endingVersion,
    xp: deriveXp(nextSnapshot.ufliProgress),
    updatedAt: appliedClientOperationIds.length > 0 ? updatedAt : snapshot.updatedAt
  };

  return {
    startingVersion,
    endingVersion,
    applied: appliedClientOperationIds.map((clientOperationId) => ({
      clientOperationId,
      appliedVersion: endingVersion
    })),
    rejected,
    snapshot: nextSnapshot
  };
};

export const ConflictResolutionPolicy = {
  applyProgressOperations
};
