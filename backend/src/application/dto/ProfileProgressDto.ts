import type { ProfileProgress } from '../../domain/models';

export interface ProfileProgressDto {
  profileId: string;
  version: number;
  ufliProgress: ProfileProgress['ufliProgress'];
  xp: number;
  selectedFriend: ProfileProgress['selectedFriend'];
  skillState: ProfileProgress['skillState'];
  skillStateSchemaVersion: number;
  updatedAt: string;
}

export const mapProfileProgressToDto = (progress: ProfileProgress): ProfileProgressDto => ({
  profileId: progress.profileId,
  version: progress.version,
  ufliProgress: Object.fromEntries(
    Object.entries(progress.ufliProgress).map(([lessonId, lessonProgress]) => [
      lessonId,
      {
        lessonComplete: lessonProgress.lessonComplete,
        activitiesComplete: { ...lessonProgress.activitiesComplete },
        connectedTextRead: lessonProgress.connectedTextRead
      }
    ])
  ),
  xp: progress.xp,
  selectedFriend: progress.selectedFriend === null ? null : { ...progress.selectedFriend },
  skillState: { ...progress.skillState },
  skillStateSchemaVersion: progress.skillStateSchemaVersion,
  updatedAt: progress.updatedAt.toISOString()
});
