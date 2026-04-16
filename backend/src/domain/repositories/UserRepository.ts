import type { User } from '../models/User';
import type { AuthProviderType } from '../types/AuthProviderType';
import type { AccountId } from '../value-objects/AccountId';
import type { UserId } from '../value-objects/UserId';
import type { Transaction } from '../../shared/persistence';

export interface UserRepository {
  getById(id: UserId, transaction?: Transaction): Promise<User | null>;
  getByAuthIdentity(authProvider: AuthProviderType, authSubject: string, transaction?: Transaction): Promise<User | null>;
  listByAccountId(accountId: AccountId, transaction?: Transaction): Promise<User[]>;
  insert(user: User, transaction?: Transaction): Promise<void>;
  update(user: User, transaction?: Transaction): Promise<void>;
}
