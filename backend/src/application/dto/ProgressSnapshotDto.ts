import type { ProfileProgress } from '../../domain/models';

import type { ProfileProgressDto } from './ProfileProgressDto';

export interface ProgressSnapshotRequestDto {
  profileId: string;
  version: number;
  ufliProgress: ProfileProgress['ufliProgress'];
  selectedFriend: ProfileProgress['selectedFriend'];
  skillState: ProfileProgress['skillState'];
  skillStateSchemaVersion: number;
}

export type ProgressSnapshotResponseDto = ProfileProgressDto;
