import type { AuthIdentity } from '../../domain/models/AuthIdentity';

export interface RequestAuthContext {
  headers: Headers;
}

export interface AuthProvider {
  authenticate(request: RequestAuthContext): Promise<AuthIdentity | null>;
}
