import type { AccountId } from '../value-objects/AccountId';
import type { ProfileId } from '../value-objects/ProfileId';

export interface Profile {
  id: ProfileId;
  accountId: AccountId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
