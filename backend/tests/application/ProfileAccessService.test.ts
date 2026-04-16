import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { ProfileAccessService } from '../../src/application/services';
import { createTestHarness } from '../fixtures/backendTestHarness';

const timestamp = new Date('2026-04-15T12:10:00.000Z');

describe('ProfileAccessService', () => {
  let harness!: Awaited<ReturnType<typeof createTestHarness>>;
  let hasHarness = false;
  let profileAccessService: ProfileAccessService;

  beforeAll(async () => {
    harness = await createTestHarness();
    hasHarness = true;
    profileAccessService = new ProfileAccessService(harness.profileRepository);
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

  test('returns profiles within the current account and denies cross-account access', async () => {
    const ownAccountId = crypto.randomUUID();
    const otherAccountId = crypto.randomUUID();
    const ownProfileId = crypto.randomUUID();
    const otherProfileId = crypto.randomUUID();

    await harness.accountRepository.insert({
      id: ownAccountId,
      name: 'Own Household',
      type: 'family',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await harness.accountRepository.insert({
      id: otherAccountId,
      name: 'Other Household',
      type: 'family',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await harness.profileRepository.insert({
      id: ownProfileId,
      accountId: ownAccountId,
      name: 'Ember',
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await harness.profileRepository.insert({
      id: otherProfileId,
      accountId: otherAccountId,
      name: 'Ash',
      createdAt: timestamp,
      updatedAt: timestamp
    });

    const currentUser = {
      userId: crypto.randomUUID(),
      accountId: ownAccountId,
      role: 'owner' as const
    };

    await expect(profileAccessService.getProfileForCurrentUser(ownProfileId, currentUser)).resolves.toMatchObject({
      id: ownProfileId,
      accountId: ownAccountId
    });

    await expect(profileAccessService.getProfileForCurrentUser(otherProfileId, currentUser)).rejects.toMatchObject({
      status: 404,
      code: 'not_found'
    });
  });
});
