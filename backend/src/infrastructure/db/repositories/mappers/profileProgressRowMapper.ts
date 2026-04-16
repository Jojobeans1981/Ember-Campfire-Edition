import type { ProfileProgress, SelectedFriend } from '../../../../domain/models/ProfileProgress';
import type { SkillState, UfliProgress } from '../../../../domain/types';
import { fromJsonField, fromNullableJsonField } from '../jsonFields';

export interface ProfileProgressRow {
  profile_id: string;
  version: number;
  ufli_progress: unknown;
  xp: number;
  selected_friend: unknown | null;
  skill_state: unknown;
  skill_state_schema_version: number;
  updated_at: Date;
}

export const mapProfileProgressRow = (row: ProfileProgressRow): ProfileProgress => ({
  profileId: row.profile_id,
  version: row.version,
  ufliProgress: fromJsonField<UfliProgress>(row.ufli_progress),
  xp: row.xp,
  selectedFriend: fromNullableJsonField<SelectedFriend>(row.selected_friend),
  skillState: fromJsonField<SkillState>(row.skill_state),
  skillStateSchemaVersion: row.skill_state_schema_version,
  updatedAt: row.updated_at
});
