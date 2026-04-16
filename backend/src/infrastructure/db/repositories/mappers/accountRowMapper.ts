import type { Account } from '../../../../domain/models/Account';
import type { AccountType } from '../../../../domain/types/AccountType';

export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  created_at: Date;
  updated_at: Date;
}

export const mapAccountRow = (row: AccountRow): Account => ({
  id: row.id,
  name: row.name,
  type: row.type,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
