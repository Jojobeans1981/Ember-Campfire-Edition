import type {
  CompleteActivityPayload,
  CompleteConnectedTextPayload,
  CompleteLessonPayload,
  ReplaceSkillStatePayload,
  SetSelectedFriendPayload
} from '../../domain/models';

import type { ProfileProgressDto } from './ProfileProgressDto';

export type ProgressOperationBatchOperationDto =
  | {
      clientOperationId: string;
      type: 'complete_lesson';
      payload: CompleteLessonPayload;
      createdAt: Date;
    }
  | {
      clientOperationId: string;
      type: 'complete_activity';
      payload: CompleteActivityPayload;
      createdAt: Date;
    }
  | {
      clientOperationId: string;
      type: 'complete_connected_text';
      payload: CompleteConnectedTextPayload;
      createdAt: Date;
    }
  | {
      clientOperationId: string;
      type: 'set_selected_friend';
      payload: SetSelectedFriendPayload;
      createdAt: Date;
    }
  | {
      clientOperationId: string;
      type: 'replace_skill_state';
      payload: ReplaceSkillStatePayload;
      createdAt: Date;
    };

export interface ProgressOperationBatchRequestDto {
  profileId: string;
  baseVersion: number;
  operations: ProgressOperationBatchOperationDto[];
}

export interface ProgressOperationBatchResponseDto {
  profileId: string;
  startingVersion: number;
  endingVersion: number;
  applied: Array<{
    clientOperationId: string;
    appliedVersion: number;
  }>;
  rejected: Array<{
    clientOperationId: string;
    code: 'conflict' | 'invalid' | 'duplicate';
    message: string;
  }>;
  snapshot: ProfileProgressDto;
}
