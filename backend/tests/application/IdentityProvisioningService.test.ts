import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { AuthIdentity } from '../../src/domain/models/AuthIdentity';
import { IdentityProvisioningService } from '../../src/application/services/IdentityProvisioningService';
import { createTestHarness } from '../fixtures/backendTestHarness';

describe('IdentityProvisioningService', () => {
  let harness!: Awaited<ReturnType<typeof createTestHarness>>;
  let hasHarness = false;

  beforeAll(async () => {
    harness = await createTestHarness();
    hasHarness = true;
  });

  beforeEach(async () => {
    if (hasHarness) {
      await harness.truncateAll();
    }
  });

  afterAll(async () => {
    if (hasHarness) {
      await harness.close();
    }
  });

  test('auto-provisions configured dev identities and reuses the same local user', async () => {
    const identity: AuthIdentity = {
      provider: 'dev',
      subject: 'dev-owner',
      email: 'owner@dev.local',
      displayName: 'Dev Owner'
    };

    const firstContext = await harness.identityProvisioningService.resolve(identity);
    const secondContext = await harness.identityProvisioningService.resolve(identity);

    expect(secondContext).toEqual(firstContext);

    const user = await harness.userRepository.getById(firstContext.userId);
    const account = await harness.accountRepository.getById(firstContext.accountId);

    expect(user?.authProvider).toBe('dev');
    expect(user?.authSubject).toBe('dev-owner');
    expect(account?.name).toBe('Dev Household');
  });

  test('rejects first-seen cognito identities when no invite/provision record exists', async () => {
    const identity: AuthIdentity = {
      provider: 'cognito',
      subject: 'cognito-sub-123',
      email: 'ember.parent@example.com',
      displayName: 'Ember Parent'
    };

    await expect(harness.identityProvisioningService.resolve(identity)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized'
    });
  });

  test('provisions invited cognito identities from provisionable identity records', async () => {
    const identity: AuthIdentity = {
      provider: 'cognito',
      subject: 'cognito-sub-123',
      email: 'ember.parent@example.com',
      displayName: 'Ember Parent'
    };

    const invitedProvisioningService = new IdentityProvisioningService({
      userRepository: harness.userRepository,
      accountRepository: harness.accountRepository,
      transactionManager: harness.database.transactionManager,
      idGenerator: { generate: () => crypto.randomUUID() },
      clock: { now: () => new Date('2026-04-15T12:00:00.000Z') },
      provisionableIdentities: [
        {
          provider: 'cognito',
          subject: 'cognito-sub-123',
          email: 'ember.parent@example.com',
          displayName: 'Ember Parent',
          accountName: 'Invited Household',
          role: 'member',
          accountType: 'family'
        }
      ]
    });

    const context = await invitedProvisioningService.resolve(identity);
    const user = await harness.userRepository.getById(context.userId);
    const account = await harness.accountRepository.getById(context.accountId);

    expect(user?.authProvider).toBe('cognito');
    expect(user?.authSubject).toBe('cognito-sub-123');
    expect(user?.role).toBe('member');
    expect(account?.name).toBe('Invited Household');
    expect(account?.type).toBe('family');
  });

  test('allows controlled cognito first-user bootstrap when explicitly enabled', async () => {
    const identity: AuthIdentity = {
      provider: 'cognito',
      subject: 'bootstrap-cognito-sub',
      email: 'owner@example.com',
      displayName: 'First Owner'
    };

    const bootstrapProvisioningService = new IdentityProvisioningService({
      userRepository: harness.userRepository,
      accountRepository: harness.accountRepository,
      transactionManager: harness.database.transactionManager,
      idGenerator: { generate: () => crypto.randomUUID() },
      clock: { now: () => new Date('2026-04-15T12:00:00.000Z') },
      canAutoProvisionCognitoIdentity: async () => true,
      cognitoProvisioningPolicy: {
        role: 'owner',
        accountType: 'family'
      }
    });

    const context = await bootstrapProvisioningService.resolve(identity);
    const user = await harness.userRepository.getById(context.userId);
    const account = await harness.accountRepository.getById(context.accountId);

    expect(user?.role).toBe('owner');
    expect(account?.type).toBe('family');
    expect(account?.name).toBe('First Owner Household');
  });

  test('rejects authenticated identities that are not provisionable', async () => {
    const identity: AuthIdentity = {
      provider: 'dev',
      subject: 'not-configured',
      email: 'missing@dev.local',
      displayName: 'Missing User'
    };

    await expect(harness.identityProvisioningService.resolve(identity)).rejects.toMatchObject({
      status: 401,
      code: 'unauthorized'
    });
  });
});
