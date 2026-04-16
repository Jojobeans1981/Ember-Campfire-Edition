import type { ProfileProgress } from '../models/ProfileProgress';
import type { ProfileId } from '../value-objects/ProfileId';
import type { Transaction } from '../../shared/persistence';

export interface ProfileProgressRepository {
  getByProfileId(profileId: ProfileId, transaction?: Transaction): Promise<ProfileProgress | null>;
  getOrCreateForUpdate(profileId: ProfileId, updatedAt: Date, transaction: Transaction): Promise<ProfileProgress>;
  upsert(progress: ProfileProgress, transaction?: Transaction): Promise<void>;
}
