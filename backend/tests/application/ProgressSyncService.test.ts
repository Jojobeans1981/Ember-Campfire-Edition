import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { Account } from '../../src/domain/models/Account';
import type { Profile } from '../../src/domain/models/Profile';
import type { ProfileProgress } from '../../src/domain/models/ProfileProgress';
import type { ProgressOperation } from '../../src/domain/models/ProgressOperation';
import { createTestHarness } from '../fixtures/backendTestHarness';

const createTimestamp = (seed: string) => new Date(seed);

const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: crypto.randomUUID(),
  name: 'Campfire Household',
  type: 'family',
  createdAt: createTimestamp('2026-04-15T09:00:00.000Z'),
  updatedAt: createTimestamp('2026-04-15T09:00:00.000Z'),
  ...overrides
});

const createProfile = (accountId: string, overrides: Partial<Profile> = {}): Profile => ({
  id: crypto.randomUUID(),
  accountId,
  name: 'Ember',
  createdAt: createTimestamp('2026-04-15T09:10:00.000Z'),
  updatedAt: createTimestamp('2026-04-15T09:10:00.000Z'),
  ...overrides
});

describe('ProgressSyncService', () => {
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

  test('replays duplicate batches idempotently without inflating XP', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const operations: ProgressOperation[] = [
      {
        profileId: profile.id,
        clientOperationId: 'op-1',
        baseVersion: 0,
        type: 'complete_lesson',
        payload: { lessonId: '001' },
        createdAt: createTimestamp('2026-04-15T12:00:00.000Z')
      },
      {
        profileId: profile.id,
        clientOperationId: 'op-2',
        baseVersion: 0,
        type: 'complete_activity',
        payload: { lessonId: '001', activityType: 'speech' },
        createdAt: createTimestamp('2026-04-15T12:00:01.000Z')
      }
    ];

    await harness.accountRepository.insert(account);
    await harness.profileRepository.insert(profile);

    const firstResult = await harness.progressSyncService.sync(profile.id, operations);
    const secondResult = await harness.progressSyncService.sync(profile.id, operations);

    expect(firstResult.applied).toEqual([
      { clientOperationId: 'op-1', appliedVersion: 1 },
      { clientOperationId: 'op-2', appliedVersion: 1 }
    ]);
    expect(firstResult.rejected).toEqual([]);
    expect(firstResult.snapshot.version).toBe(1);
    expect(firstResult.snapshot.xp).toBe(150);

    expect(secondResult.applied).toEqual([]);
    expect(secondResult.rejected).toEqual([
      {
        clientOperationId: 'op-1',
        code: 'duplicate',
        message: 'Operation has already been processed.'
      },
      {
        clientOperationId: 'op-2',
        code: 'duplicate',
        message: 'Operation has already been processed.'
      }
    ]);
    expect(secondResult.startingVersion).toBe(1);
    expect(secondResult.endingVersion).toBe(1);
    expect(secondResult.snapshot.version).toBe(1);
    expect(secondResult.snapshot.xp).toBe(150);
  });

  test('partially applies stale mixed batches while rejecting stale replace_skill_state operations', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const existingSnapshot: ProfileProgress = {
      profileId: profile.id,
      version: 2,
      ufliProgress: {},
      xp: 0,
      selectedFriend: null,
      skillState: {
        decoding: { streak: 3 }
      },
      skillStateSchemaVersion: 1,
      updatedAt: createTimestamp('2026-04-15T11:00:00.000Z')
    };

    await harness.accountRepository.insert(account);
    await harness.profileRepository.insert(profile);
    await harness.profileProgressRepository.upsert(existingSnapshot);

    const result = await harness.progressSyncService.sync(profile.id, [
      {
        profileId: profile.id,
        clientOperationId: 'op-3',
        baseVersion: 1,
        type: 'complete_lesson',
        payload: { lessonId: '002' },
        createdAt: createTimestamp('2026-04-15T12:05:00.000Z')
      },
      {
        profileId: profile.id,
        clientOperationId: 'op-4',
        baseVersion: 1,
        type: 'replace_skill_state',
        payload: {
          skillState: {
            decoding: { streak: 99 }
          },
          skillStateSchemaVersion: 2
        },
        createdAt: createTimestamp('2026-04-15T12:05:01.000Z')
      },
      {
        profileId: profile.id,
        clientOperationId: 'op-5',
        baseVersion: 1,
        type: 'set_selected_friend',
        payload: {
          selectedFriend: {
            id: 'foxfire',
            name: 'Foxfire',
            file: 'friends/foxfire.json'
          }
        },
        createdAt: createTimestamp('2026-04-15T12:05:02.000Z')
      }
    ]);

    expect(result.applied).toEqual([
      { clientOperationId: 'op-3', appliedVersion: 3 },
      { clientOperationId: 'op-5', appliedVersion: 3 }
    ]);
    expect(result.rejected).toEqual([
      {
        clientOperationId: 'op-4',
        code: 'conflict',
        message: 'Operation is stale against newer server skill state.'
      }
    ]);
    expect(result.startingVersion).toBe(2);
    expect(result.endingVersion).toBe(3);
    expect(result.snapshot.ufliProgress['002']?.lessonComplete).toBe(true);
    expect(result.snapshot.selectedFriend).toEqual({
      id: 'foxfire',
      name: 'Foxfire',
      file: 'friends/foxfire.json'
    });
    expect(result.snapshot.skillState).toEqual(existingSnapshot.skillState);
    expect(result.snapshot.skillStateSchemaVersion).toBe(1);
    expect(result.snapshot.xp).toBe(100);
  });

  test('leaves the snapshot version unchanged when every operation rejects', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);

    await harness.accountRepository.insert(account);
    await harness.profileRepository.insert(profile);

    const result = await harness.progressSyncService.sync(profile.id, [
      {
        profileId: profile.id,
        clientOperationId: 'op-6',
        baseVersion: 0,
        type: 'complete_activity',
        payload: { lessonId: '001', activityType: 'speech' },
        createdAt: createTimestamp('2026-04-15T12:10:00.000Z')
      }
    ]);

    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([
      {
        clientOperationId: 'op-6',
        code: 'invalid',
        message: 'Activity completion requires an existing lesson progress record.'
      }
    ]);
    expect(result.startingVersion).toBe(0);
    expect(result.endingVersion).toBe(0);
    expect(result.snapshot.version).toBe(0);
    expect(result.snapshot.xp).toBe(0);
  });
});
