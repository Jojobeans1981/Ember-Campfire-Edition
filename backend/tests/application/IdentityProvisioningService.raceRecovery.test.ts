import { describe, expect, test } from 'bun:test';

import type { AuthIdentity } from '../../src/domain/models/AuthIdentity';
import type { Account } from '../../src/domain/models/Account';
import type { User } from '../../src/domain/models/User';
import type { AccountRepository, UserRepository } from '../../src/domain/repositories';
import { IdentityProvisioningService } from '../../src/application/services/IdentityProvisioningService';

describe('IdentityProvisioningService race recovery', () => {
  test('recovers from duplicate user insert races by returning the existing identity mapping', async () => {
    const identity: AuthIdentity = {
      provider: 'cognito',
      subject: 'race-cognito-sub',
      email: 'race@example.com',
      displayName: 'Race Winner'
    };

    const now = new Date('2026-04-15T12:00:00.000Z');
    const accountsById = new Map<string, Account>();
    let storedUser: User | null = null;
    let authIdentityLookupCount = 0;

    const accountRepository: AccountRepository = {
      async getById(id) {
        return accountsById.get(id) ?? null;
      },
      async insert(account) {
        accountsById.set(account.id, account);
      },
      async update(account) {
        accountsById.set(account.id, account);
      }
    };

    const userRepository: UserRepository = {
      async getById(id) {
        return storedUser?.id === id ? storedUser : null;
      },
      async getByAuthIdentity() {
        authIdentityLookupCount += 1;

        if (authIdentityLookupCount <= 2) {
          return null;
        }

        return storedUser;
      },
      async listByAccountId(accountId) {
        return storedUser?.accountId === accountId ? [storedUser] : [];
      },
      async insert(user) {
        if (storedUser === null) {
          storedUser = user;
          return;
        }

        const duplicateError = new Error('duplicate key value violates unique constraint') as Error & { code: string };
        duplicateError.code = '23505';
        throw duplicateError;
      },
      async update(user) {
        storedUser = user;
      }
    };

    const service = new IdentityProvisioningService({
      userRepository,
      accountRepository,
      transactionManager: {
        withTransaction: async (work) => work({})
      },
      idGenerator: {
        generate: (() => {
          let next = 0;
          const ids = ['account-1', 'user-1', 'account-2', 'user-2'];
          return () => ids[next++] ?? `id-${next}`;
        })()
      },
      clock: { now: () => now },
      canAutoProvisionCognitoIdentity: async () => true
    });

    const [firstResult, secondResult] = await Promise.all([
      service.resolve(identity),
      service.resolve(identity)
    ]);

    expect(firstResult).toEqual({
      userId: 'user-1',
      accountId: 'account-1',
      role: 'owner'
    });
    expect(secondResult).toEqual({
      userId: 'user-1',
      accountId: 'account-1',
      role: 'owner'
    });
  });
});
