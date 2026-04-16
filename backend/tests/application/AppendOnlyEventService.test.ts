import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { Account } from '../../src/domain/models/Account';
import type { Profile } from '../../src/domain/models/Profile';
import type { ProfileProgress } from '../../src/domain/models/ProfileProgress';
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

describe('AppendOnlyEventService', () => {
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

  test('appends only new events and leaves canonical progress unchanged', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const progress: ProfileProgress = {
      profileId: profile.id,
      version: 4,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: { speech: true },
          connectedTextRead: false
        }
      },
      xp: 150,
      selectedFriend: null,
      skillState: {
        decoding: { streak: 5 }
      },
      skillStateSchemaVersion: 2,
      updatedAt: createTimestamp('2026-04-15T11:00:00.000Z')
    };

    await harness.accountRepository.insert(account);
    await harness.profileRepository.insert(profile);
    await harness.profileProgressRepository.upsert(progress);

    const result = await harness.appendOnlyEventService.append(profile.id, [
      {
        clientEventId: 'event-1',
        eventType: 'response.recorded',
        occurredAt: createTimestamp('2026-04-15T12:00:00.000Z'),
        schemaVersion: 1,
        payload: {
          modality: 'tap_select',
          extraField: {
            nested: true
          }
        }
      },
      {
        clientEventId: 'event-1',
        eventType: 'response.recorded',
        occurredAt: createTimestamp('2026-04-15T12:00:01.000Z'),
        schemaVersion: 1,
        payload: {
          ignored: true
        }
      }
    ]);

    expect(result).toEqual({
      profileId: profile.id,
      appended: [{ clientEventId: 'event-1' }],
      duplicate: [{ clientEventId: 'event-1' }]
    });
    expect(await harness.profileProgressRepository.getByProfileId(profile.id)).toEqual(progress);
  });

  test('reports persisted duplicates without mutating canonical progress', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const progress: ProfileProgress = {
      profileId: profile.id,
      version: 2,
      ufliProgress: {},
      xp: 50,
      selectedFriend: null,
      skillState: {},
      skillStateSchemaVersion: 1,
      updatedAt: createTimestamp('2026-04-15T10:00:00.000Z')
    };

    await harness.accountRepository.insert(account);
    await harness.profileRepository.insert(profile);
    await harness.profileProgressRepository.upsert(progress);
    await harness.eventRepository.append({
      id: crypto.randomUUID(),
      profileId: profile.id,
      clientEventId: 'event-1',
      eventType: 'response.recorded',
      occurredAt: createTimestamp('2026-04-15T12:00:00.000Z'),
      schemaVersion: 1,
      payload: {
        preserved: true
      },
      receivedAt: createTimestamp('2026-04-15T12:00:00.000Z')
    });

    const result = await harness.appendOnlyEventService.append(profile.id, [
      {
        clientEventId: 'event-1',
        eventType: 'response.recorded',
        occurredAt: createTimestamp('2026-04-15T12:01:00.000Z'),
        schemaVersion: 1,
        payload: {
          ignored: true
        }
      }
    ]);

    expect(result).toEqual({
      profileId: profile.id,
      appended: [],
      duplicate: [{ clientEventId: 'event-1' }]
    });
    expect(await harness.profileProgressRepository.getByProfileId(profile.id)).toEqual(progress);
  });
});
