import type { UserRole } from '../../domain/types/UserRole';

export interface MeDto {
  id: string;
  accountId: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  authProvider: string;
  createdAt: string;
  updatedAt: string;
}
