import type { AuthProviderType } from '../types/AuthProviderType';
import type { UserRole } from '../types/UserRole';
import type { AccountId } from '../value-objects/AccountId';
import type { UserId } from '../value-objects/UserId';

export interface User {
  id: UserId;
  accountId: AccountId;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  authProvider: AuthProviderType;
  authSubject: string;
  createdAt: Date;
  updatedAt: Date;
}
