import type { Account } from '../models/Account';
import type { AccountId } from '../value-objects/AccountId';
import type { Transaction } from '../../shared/persistence';

export interface AccountRepository {
  getById(id: AccountId, transaction?: Transaction): Promise<Account | null>;
  insert(account: Account, transaction?: Transaction): Promise<void>;
  update(account: Account, transaction?: Transaction): Promise<void>;
}
