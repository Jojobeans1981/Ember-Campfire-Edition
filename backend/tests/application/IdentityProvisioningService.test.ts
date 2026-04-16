import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { AuthIdentity } from '../../src/domain/models/AuthIdentity';
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
