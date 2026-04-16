import type { DevAuthUserConfig } from '../../config/env';
import type { ProvisionableIdentityConfig } from '../../../application/services';

export const mapDevUsersToProvisionableIdentities = (
  devUsers: DevAuthUserConfig[]
): ProvisionableIdentityConfig[] => {
  return devUsers.map((devUser) => ({
    provider: 'dev',
    subject: devUser.subject,
    email: devUser.email,
    displayName: devUser.displayName,
    accountName: devUser.accountName,
    role: devUser.role,
    accountType: 'family'
  }));
};
