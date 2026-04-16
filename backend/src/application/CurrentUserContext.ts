import type { UserRole } from '../domain/types/UserRole';

export interface CurrentUserContext {
  userId: string;
  accountId: string;
  role: UserRole;
}
