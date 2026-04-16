import type { User } from '../../../../domain/models/User';
import type { AuthProviderType } from '../../../../domain/types/AuthProviderType';
import type { UserRole } from '../../../../domain/types/UserRole';

export interface UserRow {
  id: string;
  account_id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  auth_provider: AuthProviderType;
  auth_subject: string;
  created_at: Date;
  updated_at: Date;
}

export const mapUserRow = (row: UserRow): User => ({
  id: row.id,
  accountId: row.account_id,
  email: row.email,
  displayName: row.display_name,
  role: row.role,
  authProvider: row.auth_provider,
  authSubject: row.auth_subject,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
