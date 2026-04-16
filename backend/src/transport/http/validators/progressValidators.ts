import type { EventBatchEventDto, EventBatchRequestDto } from '../../../application/dto/EventBatchDto';
import type { ProgressOperationBatchRequestDto } from '../../../application/dto/ProgressOperationBatchDto';
import type { ProgressOperationBatchOperationDto } from '../../../application/dto/ProgressOperationBatchDto';
import type { ProgressSnapshotRequestDto } from '../../../application/dto/ProgressSnapshotDto';
import type { ProgressOperation } from '../../../domain/models';
import type { UfliLessonProgress, UfliProgress } from '../../../domain/types';

import { PROGRESS_OPERATION_TYPES, UFLI_ACTIVITY_TYPES } from '../../../domain/types';
import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/ErrorCodes';
import {
  assertArray,
  assertBoolean,
  assertInteger,
  assertIsoDateString,
  assertMaxLength,
  assertNonEmptyString,
  assertObject,
  assertUuidString,
  parseJsonObjectBody
} from './commonValidators';

const parseSelectedFriend = (
  value: unknown,
  fieldName = 'operations[].payload.selectedFriend'
): { id: string; name: string; file: string } | null => {
  if (value === null) {
    return null;
  }

  const selectedFriend = assertObject(value, fieldName);

  return {
    id: assertMaxLength(assertNonEmptyString(selectedFriend.id, `${fieldName}.id`), `${fieldName}.id`, 100),
    name: assertMaxLength(assertNonEmptyString(selectedFriend.name, `${fieldName}.name`), `${fieldName}.name`, 100),
    file: assertMaxLength(assertNonEmptyString(selectedFriend.file, `${fieldName}.file`), `${fieldName}.file`, 255)
  };
};

const parseUfliLessonProgress = (value: unknown, fieldName: string): UfliLessonProgress => {
  const lessonProgress = assertObject(value, fieldName);
  const activitiesComplete = assertObject(lessonProgress.activitiesComplete, `${fieldName}.activitiesComplete`);

  return {
    lessonComplete: assertBoolean(lessonProgress.lessonComplete, `${fieldName}.lessonComplete`),
    activitiesComplete: Object.fromEntries(
      Object.entries(activitiesComplete).map(([activityType, completed]) => {
        if (!UFLI_ACTIVITY_TYPES.includes(activityType as (typeof UFLI_ACTIVITY_TYPES)[number])) {
          throw new AppError(`${fieldName}.activitiesComplete contains an unsupported activity type`, {
            code: ERROR_CODES.VALIDATION_ERROR,
            status: 422
          });
        }

        return [
          activityType,
          assertBoolean(completed, `${fieldName}.activitiesComplete.${activityType}`)
        ];
      })
    ) as UfliLessonProgress['activitiesComplete'],
    connectedTextRead: assertBoolean(lessonProgress.connectedTextRead, `${fieldName}.connectedTextRead`)
  };
};

const parseUfliProgress = (value: unknown): UfliProgress => {
  const ufliProgress = assertObject(value, 'ufliProgress');

  return Object.fromEntries(
    Object.entries(ufliProgress).map(([lessonId, lessonProgress]) => [
      lessonId,
      parseUfliLessonProgress(lessonProgress, `ufliProgress.${lessonId}`)
    ])
  ) as UfliProgress;
};

const assertProgressOperationType = (value: unknown): ProgressOperation['type'] => {
  const type = assertNonEmptyString(value, 'operations[].type');

  if (!PROGRESS_OPERATION_TYPES.includes(type as ProgressOperation['type'])) {
    throw new AppError('operations[].type must be a supported progress operation type', {
      code: ERROR_CODES.VALIDATION_ERROR,
      status: 422
    });
  }

  return type as ProgressOperation['type'];
};

const EVENT_BATCH_LIMIT = 100;

export const parseProfileIdParam = (profileId: string): string => {
  return assertUuidString(profileId, 'profileId');
};

export const parseSubmitProgressOperationBatchRequest = async (
  request: Request,
  profileId: string
): Promise<ProgressOperationBatchRequestDto> => {
  const body = await parseJsonObjectBody(request);
  const operations = assertArray(body.operations, 'operations').map((operation): ProgressOperationBatchOperationDto => {
    const operationObject = assertObject(operation, 'operations[]');
    const type = assertProgressOperationType(operationObject.type);
    const clientOperationId = assertMaxLength(
      assertNonEmptyString(operationObject.clientOperationId, 'operations[].clientOperationId'),
      'operations[].clientOperationId',
      100
    );
    const createdAt = assertIsoDateString(operationObject.createdAt, 'operations[].createdAt');

    switch (type) {
      case 'complete_lesson':
        return {
          clientOperationId,
          type,
          payload: {
            lessonId: assertMaxLength(
              assertNonEmptyString(assertObject(operationObject.payload, 'operations[].payload').lessonId, 'operations[].payload.lessonId'),
              'operations[].payload.lessonId',
              32
            )
          },
          createdAt
        };
      case 'complete_activity':
        {
          const payload = assertObject(operationObject.payload, 'operations[].payload');
          const activityType = assertNonEmptyString(payload.activityType, 'operations[].payload.activityType');

          if (!UFLI_ACTIVITY_TYPES.includes(activityType as (typeof UFLI_ACTIVITY_TYPES)[number])) {
            throw new AppError('operations[].payload.activityType must be a supported UFLI activity type', {
              code: ERROR_CODES.VALIDATION_ERROR,
              status: 422
            });
          }

          return {
            clientOperationId,
            type,
            payload: {
              lessonId: assertMaxLength(
                assertNonEmptyString(payload.lessonId, 'operations[].payload.lessonId'),
                'operations[].payload.lessonId',
                32
              ),
              activityType: activityType as (typeof UFLI_ACTIVITY_TYPES)[number]
            },
            createdAt
          };
        }
      case 'complete_connected_text':
        return {
          clientOperationId,
          type,
          payload: {
            lessonId: assertMaxLength(
              assertNonEmptyString(assertObject(operationObject.payload, 'operations[].payload').lessonId, 'operations[].payload.lessonId'),
              'operations[].payload.lessonId',
              32
            )
          },
          createdAt
        };
      case 'set_selected_friend':
        return {
          clientOperationId,
          type,
          payload: {
            selectedFriend: parseSelectedFriend(
              assertObject(operationObject.payload, 'operations[].payload').selectedFriend
            )
          },
          createdAt
        };
      case 'replace_skill_state':
        {
          const payload = assertObject(operationObject.payload, 'operations[].payload');

          return {
            clientOperationId,
            type,
            payload: {
              skillState: assertObject(payload.skillState, 'operations[].payload.skillState'),
              skillStateSchemaVersion: assertInteger(
                payload.skillStateSchemaVersion,
                'operations[].payload.skillStateSchemaVersion',
                1
              )
            },
            createdAt
          };
        }
    }
  });

  return {
    profileId: parseProfileIdParam(profileId),
    baseVersion: assertInteger(body.baseVersion, 'baseVersion', 0),
    operations
  };
};

export const parseSubmitProgressSnapshotRequest = async (
  request: Request,
  profileId: string
): Promise<ProgressSnapshotRequestDto> => {
  const body = await parseJsonObjectBody(request);

  return {
    profileId: parseProfileIdParam(profileId),
    version: assertInteger(body.version, 'version', 0),
    ufliProgress: parseUfliProgress(body.ufliProgress),
    selectedFriend: parseSelectedFriend(body.selectedFriend, 'selectedFriend'),
    skillState: assertObject(body.skillState, 'skillState'),
    skillStateSchemaVersion: assertInteger(body.skillStateSchemaVersion, 'skillStateSchemaVersion', 1)
  };
};

export const parseAppendEventsRequest = async (
  request: Request,
  profileId: string
): Promise<EventBatchRequestDto> => {
  const body = await parseJsonObjectBody(request);
  const events = assertArray(body.events, 'events');

  if (events.length > EVENT_BATCH_LIMIT) {
    throw new AppError(`events must contain at most ${EVENT_BATCH_LIMIT} items`, {
      code: ERROR_CODES.VALIDATION_ERROR,
      status: 422
    });
  }

  return {
    profileId: parseProfileIdParam(profileId),
    events: events.map((event): EventBatchEventDto => {
      const eventObject = assertObject(event, 'events[]');

      return {
        clientEventId: assertMaxLength(
          assertNonEmptyString(eventObject.clientEventId, 'events[].clientEventId'),
          'events[].clientEventId',
          100
        ),
        eventType: assertMaxLength(
          assertNonEmptyString(eventObject.eventType, 'events[].eventType'),
          'events[].eventType',
          100
        ),
        occurredAt: assertIsoDateString(eventObject.occurredAt, 'events[].occurredAt'),
        schemaVersion: assertInteger(eventObject.schemaVersion, 'events[].schemaVersion', 1),
        payload: assertObject(eventObject.payload, 'events[].payload')
      };
    })
  };
};
