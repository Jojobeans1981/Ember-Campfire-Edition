import type { Profile } from '../models/Profile';
import type { AccountId } from '../value-objects/AccountId';
import type { ProfileId } from '../value-objects/ProfileId';
import type { Transaction } from '../../shared/persistence';

export interface ProfileRepository {
  getById(id: ProfileId, transaction?: Transaction): Promise<Profile | null>;
  listByAccountId(accountId: AccountId, transaction?: Transaction): Promise<Profile[]>;
  insert(profile: Profile, transaction?: Transaction): Promise<void>;
  update(profile: Profile, transaction?: Transaction): Promise<void>;
}
