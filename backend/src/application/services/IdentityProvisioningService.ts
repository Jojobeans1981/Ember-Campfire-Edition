import type { AuthIdentity } from '../../domain/models/AuthIdentity';
import type { User } from '../../domain/models/User';
import type { AccountRepository, UserRepository } from '../../domain/repositories';
import type { AccountType } from '../../domain/types/AccountType';
import type { UserRole } from '../../domain/types/UserRole';
import type { IdGenerator } from '../../shared/ids/IdGenerator';
import type { Transaction, TransactionManager } from '../../shared/persistence';
import type { Clock } from '../../shared/time/Clock';

import type { CurrentUserContext } from '../CurrentUserContext';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';

export interface ProvisionableIdentityConfig {
  provider: AuthIdentity['provider'];
  subject: string;
  email: string | null;
  displayName: string | null;
  accountName: string;
  role: UserRole;
  accountType: AccountType;
}

export interface CognitoProvisioningPolicy {
  role: UserRole;
  accountType: AccountType;
}

export const DEFAULT_COGNITO_PROVISIONING_POLICY: CognitoProvisioningPolicy = {
  role: 'owner',
  accountType: 'family'
};

export const createIdentityKey = (provider: AuthIdentity['provider'], subject: string): string => {
  return `${provider}:${subject}`;
};

export class IdentityProvisioningService {
  private readonly provisionableIdentities: Map<string, ProvisionableIdentityConfig>;

  public constructor(private readonly dependencies: {
    userRepository: UserRepository;
    accountRepository: AccountRepository;
    transactionManager: TransactionManager;
    idGenerator: IdGenerator;
    clock: Clock;
    provisionableIdentities?: ProvisionableIdentityConfig[];
    cognitoProvisioningPolicy?: CognitoProvisioningPolicy;
    /**
     * Optional controlled bootstrap path for Cognito identities when no invite/provision record exists.
     * This must only be enabled when Cognito user creation is admin-approved (for example,
     * allow_admin_create_user_only=true) to prevent self-signup privilege escalation.
     */
    canAutoProvisionCognitoIdentity?: (
      identity: AuthIdentity,
      transaction: Transaction
    ) => Promise<boolean>;
  }) {
    this.provisionableIdentities = new Map(
      (dependencies.provisionableIdentities ?? []).map((identity) => [
        createIdentityKey(identity.provider, identity.subject),
        identity
      ])
    );
  }

  public async resolve(identity: AuthIdentity): Promise<CurrentUserContext> {
    return this.dependencies.transactionManager.withTransaction(async (transaction) => {
      const existingUser = await this.dependencies.userRepository.getByAuthIdentity(
        identity.provider,
        identity.subject,
        transaction
      );

      if (existingUser !== null) {
        return this.resolveExistingUserContext(existingUser, identity, transaction);
      }

      const provisionableIdentity = this.provisionableIdentities.get(
        createIdentityKey(identity.provider, identity.subject)
      );

      const resolvedProvisioning = await this.resolveProvisioning(identity, provisionableIdentity, transaction);

      if (resolvedProvisioning === null) {
        throw new AppError('Authenticated user is not provisioned', {
          code: ERROR_CODES.UNAUTHORIZED,
          status: 401
        });
      }

      const now = this.dependencies.clock.now();
      const accountId = this.dependencies.idGenerator.generate();
      const userId = this.dependencies.idGenerator.generate();

      await this.dependencies.accountRepository.insert(
        {
          id: accountId,
          name: resolvedProvisioning.accountName,
          type: resolvedProvisioning.accountType,
          createdAt: now,
          updatedAt: now
        },
        transaction
      );

      try {
        await this.dependencies.userRepository.insert(
          {
            id: userId,
            accountId,
            email: identity.email,
            displayName: identity.displayName,
            role: resolvedProvisioning.role,
            authProvider: identity.provider,
            authSubject: identity.subject,
            createdAt: now,
            updatedAt: now
          },
          transaction
        );
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }

        const racedUser = await this.dependencies.userRepository.getByAuthIdentity(
          identity.provider,
          identity.subject,
          transaction
        );

        if (racedUser === null) {
          throw error;
        }

        return this.resolveExistingUserContext(racedUser, identity, transaction);
      }

      return {
        userId,
        accountId,
        role: resolvedProvisioning.role
      };
    });
  }

  private async resolveExistingUserContext(
    existingUser: User,
    identity: AuthIdentity,
    transaction: Transaction
  ): Promise<CurrentUserContext> {
    const account = await this.dependencies.accountRepository.getById(existingUser.accountId, transaction);

    if (account === null) {
      throw new AppError('Authenticated user account was not found', {
        code: ERROR_CODES.CONFLICT,
        status: 409
      });
    }

    if (existingUser.email !== identity.email || existingUser.displayName !== identity.displayName) {
      await this.dependencies.userRepository.update(
        {
          ...existingUser,
          email: identity.email,
          displayName: identity.displayName,
          updatedAt: this.dependencies.clock.now()
        },
        transaction
      );
    }

    return {
      userId: existingUser.id,
      accountId: existingUser.accountId,
      role: existingUser.role
    };
  }

  private async resolveProvisioning(
    identity: AuthIdentity,
    provisionableIdentity: ProvisionableIdentityConfig | undefined,
    transaction: Transaction
  ): Promise<ProvisionableIdentityConfig | null> {
    if (provisionableIdentity !== undefined) {
      return provisionableIdentity;
    }

    if (identity.provider !== 'cognito') {
      return null;
    }

    const shouldAutoProvision = await this.dependencies.canAutoProvisionCognitoIdentity?.(identity, transaction);
    if (!shouldAutoProvision) {
      return null;
    }

    return createCognitoProvisioning(identity, this.dependencies.cognitoProvisioningPolicy);
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

const createCognitoProvisioning = (
  identity: AuthIdentity,
  policy: CognitoProvisioningPolicy = DEFAULT_COGNITO_PROVISIONING_POLICY
): ProvisionableIdentityConfig => ({
  provider: 'cognito',
  subject: identity.subject,
  email: identity.email,
  displayName: identity.displayName,
  accountName: deriveAccountName(identity),
  role: policy.role,
  accountType: policy.accountType
});

const deriveAccountName = (identity: AuthIdentity): string => {
  const displayName = identity.displayName?.trim();

  if (displayName) {
    return `${displayName} Household`;
  }

  const emailLocalPart = identity.email?.split('@')[0]?.trim();

  if (emailLocalPart) {
    return `${emailLocalPart} Household`;
  }

  return 'Ember Household';
};
