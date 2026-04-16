import type { AccountType } from '../types/AccountType';
import type { AccountId } from '../value-objects/AccountId';

export interface Account {
  id: AccountId;
  name: string;
  type: AccountType;
  createdAt: Date;
  updatedAt: Date;
}
