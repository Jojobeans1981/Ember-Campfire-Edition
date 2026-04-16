import type { Profile } from '../../../../domain/models/Profile';

export interface ProfileRow {
  id: string;
  account_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export const mapProfileRow = (row: ProfileRow): Profile => ({
  id: row.id,
  accountId: row.account_id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
