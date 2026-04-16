import type { AuthIdentity } from '../../domain/models/AuthIdentity';
import type { AccountRepository, UserRepository } from '../../domain/repositories';
import type { AccountType } from '../../domain/types/AccountType';
import type { UserRole } from '../../domain/types/UserRole';
import type { IdGenerator } from '../../shared/ids/IdGenerator';
import type { TransactionManager } from '../../shared/persistence';
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

export class IdentityProvisioningService {
  private readonly provisionableIdentities: Map<string, ProvisionableIdentityConfig>;

  public constructor(private readonly dependencies: {
    userRepository: UserRepository;
    accountRepository: AccountRepository;
    transactionManager: TransactionManager;
    idGenerator: IdGenerator;
    clock: Clock;
    provisionableIdentities?: ProvisionableIdentityConfig[];
  }) {
    this.provisionableIdentities = new Map(
      (dependencies.provisionableIdentities ?? []).map((identity) => [
        this.createIdentityKey(identity.provider, identity.subject),
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

      const provisionableIdentity = this.provisionableIdentities.get(
        this.createIdentityKey(identity.provider, identity.subject)
      );

      if (provisionableIdentity === undefined) {
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
          name: provisionableIdentity.accountName,
          type: provisionableIdentity.accountType,
          createdAt: now,
          updatedAt: now
        },
        transaction
      );

      await this.dependencies.userRepository.insert(
        {
          id: userId,
          accountId,
          email: identity.email,
          displayName: identity.displayName,
          role: provisionableIdentity.role,
          authProvider: identity.provider,
          authSubject: identity.subject,
          createdAt: now,
          updatedAt: now
        },
        transaction
      );

      return {
        userId,
        accountId,
        role: provisionableIdentity.role
      };
    });
  }

  private createIdentityKey(provider: AuthIdentity['provider'], subject: string): string {
    return `${provider}:${subject}`;
  }
}
