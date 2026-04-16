import type { SkillState, UfliProgress } from '../types';
import type { ProfileId } from '../value-objects/ProfileId';

export interface SelectedFriend {
  id: string;
  name: string;
  file: string;
}

export interface ProfileProgress {
  profileId: ProfileId;
  version: number;
  ufliProgress: UfliProgress;
  xp: number;
  selectedFriend: SelectedFriend | null;
  skillState: SkillState;
  skillStateSchemaVersion: number;
  updatedAt: Date;
}

export const createEmptyProfileProgress = (profileId: ProfileId, updatedAt: Date): ProfileProgress => ({
  profileId,
  version: 0,
  ufliProgress: {},
  xp: 0,
  selectedFriend: null,
  skillState: {},
  skillStateSchemaVersion: 1,
  updatedAt
});
