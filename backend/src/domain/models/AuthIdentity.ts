import type { AuthProviderType } from '../types/AuthProviderType';

export interface AuthIdentity {
  provider: AuthProviderType;
  subject: string;
  email: string | null;
  displayName: string | null;
}
