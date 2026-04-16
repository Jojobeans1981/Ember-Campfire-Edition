import type { SkillState, UfliActivityType } from '../types';
import type { ProfileId } from '../value-objects/ProfileId';
import type { SelectedFriend } from './ProfileProgress';

export interface CompleteLessonPayload {
  lessonId: string;
}

export interface CompleteActivityPayload {
  lessonId: string;
  activityType: UfliActivityType;
}

export interface CompleteConnectedTextPayload {
  lessonId: string;
}

export interface SetSelectedFriendPayload {
  selectedFriend: SelectedFriend | null;
}

export interface ReplaceSkillStatePayload {
  skillState: SkillState;
  skillStateSchemaVersion: number;
}

interface BaseProgressOperation<TType extends string, TPayload> {
  profileId: ProfileId;
  clientOperationId: string;
  baseVersion: number;
  type: TType;
  payload: TPayload;
  createdAt: Date;
}

export type CompleteLessonOperation = BaseProgressOperation<'complete_lesson', CompleteLessonPayload>;
export type CompleteActivityOperation = BaseProgressOperation<'complete_activity', CompleteActivityPayload>;
export type CompleteConnectedTextOperation = BaseProgressOperation<'complete_connected_text', CompleteConnectedTextPayload>;
export type SetSelectedFriendOperation = BaseProgressOperation<'set_selected_friend', SetSelectedFriendPayload>;
export type ReplaceSkillStateOperation = BaseProgressOperation<'replace_skill_state', ReplaceSkillStatePayload>;

export type ProgressOperation =
  | CompleteLessonOperation
  | CompleteActivityOperation
  | CompleteConnectedTextOperation
  | SetSelectedFriendOperation
  | ReplaceSkillStateOperation;

export type ProgressOperationRejectionCode = 'conflict' | 'invalid' | 'duplicate';
