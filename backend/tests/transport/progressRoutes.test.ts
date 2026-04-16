import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { Account } from '../../src/domain/models/Account';
import type { Profile } from '../../src/domain/models/Profile';
import type { ProfileProgress } from '../../src/domain/models/ProfileProgress';
import { createTestHarness } from '../fixtures/backendTestHarness';

const createTimestamp = (seed: string) => new Date(seed);

const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: crypto.randomUUID(),
  name: 'Other Household',
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

describe('progress routes', () => {
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

  test('returns an empty snapshot for a new profile', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress`, {
        headers: authorization
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profileId: profile.id,
      version: 0,
      ufliProgress: {},
      xp: 0,
      selectedFriend: null,
      skillState: {},
      skillStateSchemaVersion: 1,
      updatedAt: '2026-04-15T12:00:00.000Z'
    });
  });

  test('returns populated canonical progress snapshots', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };
    const snapshot: ProfileProgress = {
      profileId: profile.id,
      version: 4,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: {
            speech: true,
            match: true
          },
          connectedTextRead: false
        }
      },
      xp: 200,
      selectedFriend: {
        id: 'foxfire',
        name: 'Foxfire',
        file: 'friends/foxfire.json'
      },
      skillState: {
        decoding: {
          streak: 7,
          lastLessonId: '001'
        }
      },
      skillStateSchemaVersion: 3,
      updatedAt: createTimestamp('2026-04-15T11:30:00.000Z')
    };

    await harness.profileProgressRepository.upsert(snapshot);

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress`, {
        headers: authorization
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profileId: profile.id,
      version: 4,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: {
            speech: true,
            match: true
          },
          connectedTextRead: false
        }
      },
      xp: 200,
      selectedFriend: {
        id: 'foxfire',
        name: 'Foxfire',
        file: 'friends/foxfire.json'
      },
      skillState: {
        decoding: {
          streak: 7,
          lastLessonId: '001'
        }
      },
      skillStateSchemaVersion: 3,
      updatedAt: '2026-04-15T11:30:00.000Z'
    });
  });

  test('accepts current-version recovery snapshots and recomputes XP server-side', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-snapshot`, {
        method: 'PUT',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          version: 0,
          xp: 9999,
          ufliProgress: {
            '001': {
              lessonComplete: true,
              activitiesComplete: {
                speech: true,
                match: true
              },
              connectedTextRead: true
            }
          },
          selectedFriend: {
            id: 'foxfire',
            name: 'Foxfire',
            file: 'friends/foxfire.json'
          },
          skillState: {
            decoding: {
              streak: 7
            }
          },
          skillStateSchemaVersion: 3,
          updatedAt: '2026-04-15T10:00:00.000Z'
        })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profileId: profile.id,
      version: 1,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: {
            speech: true,
            match: true
          },
          connectedTextRead: true
        }
      },
      xp: 275,
      selectedFriend: {
        id: 'foxfire',
        name: 'Foxfire',
        file: 'friends/foxfire.json'
      },
      skillState: {
        decoding: {
          streak: 7
        }
      },
      skillStateSchemaVersion: 3,
      updatedAt: '2026-04-15T12:00:00.000Z'
    });
  });

  test('rejects stale recovery snapshots with a conflict response', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    await harness.profileProgressRepository.upsert({
      profileId: profile.id,
      version: 2,
      ufliProgress: {},
      xp: 0,
      selectedFriend: null,
      skillState: {
        decoding: {
          streak: 3
        }
      },
      skillStateSchemaVersion: 1,
      updatedAt: createTimestamp('2026-04-15T11:00:00.000Z')
    });

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-snapshot`, {
        method: 'PUT',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          version: 1,
          ufliProgress: {},
          selectedFriend: null,
          skillState: {},
          skillStateSchemaVersion: 1
        })
      })
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'conflict',
        message: 'Progress snapshot is stale against the current server version.'
      }
    });
  });

  test('validates progress operation payloads', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-operations`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          baseVersion: 0,
          operations: [
            {
              clientOperationId: 'op-1',
              type: 'complete_activity',
              payload: {
                lessonId: '001',
                activityType: 'not-real'
              },
              createdAt: '2026-04-15T12:00:00.000Z'
            }
          ]
        })
      })
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'operations[].payload.activityType must be a supported UFLI activity type'
      }
    });
  });

  test('returns duplicate rejections on replay and partial success on stale mixed batches', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    const firstResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-operations`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          baseVersion: 0,
          operations: [
            {
              clientOperationId: 'op-1',
              type: 'complete_lesson',
              payload: { lessonId: '001' },
              createdAt: '2026-04-15T12:00:00.000Z'
            },
            {
              clientOperationId: 'op-2',
              type: 'set_selected_friend',
              payload: {
                selectedFriend: {
                  id: 'foxfire',
                  name: 'Foxfire',
                  file: 'friends/foxfire.json'
                }
              },
              createdAt: '2026-04-15T12:00:01.000Z'
            }
          ]
        })
      })
    );

    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({
      profileId: profile.id,
      startingVersion: 0,
      endingVersion: 1,
      applied: [
        { clientOperationId: 'op-1', appliedVersion: 1 },
        { clientOperationId: 'op-2', appliedVersion: 1 }
      ],
      rejected: [],
      snapshot: {
        profileId: profile.id,
        version: 1,
        ufliProgress: {
          '001': {
            lessonComplete: true,
            activitiesComplete: {},
            connectedTextRead: false
          }
        },
        xp: 100,
        selectedFriend: {
          id: 'foxfire',
          name: 'Foxfire',
          file: 'friends/foxfire.json'
        },
        skillState: {},
        skillStateSchemaVersion: 1,
        updatedAt: '2026-04-15T12:00:00.000Z'
      }
    });

    const replayResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-operations`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          baseVersion: 0,
          operations: [
            {
              clientOperationId: 'op-1',
              type: 'complete_lesson',
              payload: { lessonId: '001' },
              createdAt: '2026-04-15T12:00:00.000Z'
            },
            {
              clientOperationId: 'op-2',
              type: 'set_selected_friend',
              payload: {
                selectedFriend: {
                  id: 'foxfire',
                  name: 'Foxfire',
                  file: 'friends/foxfire.json'
                }
              },
              createdAt: '2026-04-15T12:00:01.000Z'
            }
          ]
        })
      })
    );

    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toEqual({
      profileId: profile.id,
      startingVersion: 1,
      endingVersion: 1,
      applied: [],
      rejected: [
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
      ],
      snapshot: {
        profileId: profile.id,
        version: 1,
        ufliProgress: {
          '001': {
            lessonComplete: true,
            activitiesComplete: {},
            connectedTextRead: false
          }
        },
        xp: 100,
        selectedFriend: {
          id: 'foxfire',
          name: 'Foxfire',
          file: 'friends/foxfire.json'
        },
        skillState: {},
        skillStateSchemaVersion: 1,
        updatedAt: '2026-04-15T12:00:00.000Z'
      }
    });

    const mixedResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/progress-operations`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          baseVersion: 0,
          operations: [
            {
              clientOperationId: 'op-3',
              type: 'complete_activity',
              payload: {
                lessonId: '001',
                activityType: 'speech'
              },
              createdAt: '2026-04-15T12:10:00.000Z'
            },
            {
              clientOperationId: 'op-4',
              type: 'replace_skill_state',
              payload: {
                skillState: {
                  decoding: { streak: 99 }
                },
                skillStateSchemaVersion: 2
              },
              createdAt: '2026-04-15T12:10:01.000Z'
            }
          ]
        })
      })
    );

    expect(mixedResponse.status).toBe(200);
    expect(await mixedResponse.json()).toEqual({
      profileId: profile.id,
      startingVersion: 1,
      endingVersion: 2,
      applied: [{ clientOperationId: 'op-3', appliedVersion: 2 }],
      rejected: [
        {
          clientOperationId: 'op-4',
          code: 'conflict',
          message: 'Operation is stale against newer server skill state.'
        }
      ],
      snapshot: {
        profileId: profile.id,
        version: 2,
        ufliProgress: {
          '001': {
            lessonComplete: true,
            activitiesComplete: {
              speech: true
            },
            connectedTextRead: false
          }
        },
        xp: 150,
        selectedFriend: {
          id: 'foxfire',
          name: 'Foxfire',
          file: 'friends/foxfire.json'
        },
        skillState: {},
        skillStateSchemaVersion: 1,
        updatedAt: '2026-04-15T12:00:00.000Z'
      }
    });
  });

  test('validates event batches and accepts unknown event types without mutating progress', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };
    const existingSnapshot: ProfileProgress = {
      profileId: profile.id,
      version: 3,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: {
            speech: true
          },
          connectedTextRead: false
        }
      },
      xp: 150,
      selectedFriend: null,
      skillState: {
        decoding: {
          streak: 2
        }
      },
      skillStateSchemaVersion: 1,
      updatedAt: createTimestamp('2026-04-15T11:00:00.000Z')
    };

    await harness.profileProgressRepository.upsert(existingSnapshot);

    const invalidResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/events`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          events: [
            {
              clientEventId: 'event-1',
              eventType: 'response.recorded',
              occurredAt: '2026-04-15T12:00:00.000Z',
              schemaVersion: 1,
              payload: ['not-an-object']
            }
          ]
        })
      })
    );

    expect(invalidResponse.status).toBe(422);
    expect(await invalidResponse.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'events[].payload must be an object'
      }
    });

    const firstResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/events`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          events: [
            {
              clientEventId: 'event-1',
              eventType: 'unknown.future.event',
              occurredAt: '2026-04-15T12:00:00.000Z',
              schemaVersion: 1,
              payload: {
                arbitrary: true,
                nested: {
                  count: 2
                }
              }
            },
            {
              clientEventId: 'event-2',
              eventType: 'response.recorded',
              occurredAt: '2026-04-15T12:01:00.000Z',
              schemaVersion: 1,
              payload: {
                itemId: 'match-m',
                correct: true
              }
            }
          ]
        })
      })
    );

    expect(firstResponse.status).toBe(200);
    expect(await firstResponse.json()).toEqual({
      profileId: profile.id,
      appended: [
        { clientEventId: 'event-1' },
        { clientEventId: 'event-2' }
      ],
      duplicate: []
    });

    const replayResponse = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/events`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          events: [
            {
              clientEventId: 'event-1',
              eventType: 'unknown.future.event',
              occurredAt: '2026-04-15T12:00:00.000Z',
              schemaVersion: 1,
              payload: {
                arbitrary: false
              }
            }
          ]
        })
      })
    );

    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toEqual({
      profileId: profile.id,
      appended: [],
      duplicate: [{ clientEventId: 'event-1' }]
    });
    expect(await harness.profileProgressRepository.getByProfileId(profile.id)).toEqual(existingSnapshot);
  });

  test('validates required event envelope fields for event ingestion', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };
    const createProfileResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    const profile = await createProfileResponse.json() as { id: string };

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${profile.id}/events`, {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          events: [
            {
              eventType: 'response.recorded',
              occurredAt: '2026-04-15T12:00:00.000Z',
              payload: {
                itemId: 'match-m',
                correct: true,
                bonusField: 'accepted'
              }
            }
          ]
        })
      })
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'events[].clientEventId must be a string'
      }
    });
  });

  test('blocks cross-account progress access', async () => {
    const otherAccount = createAccount();
    const otherProfile = createProfile(otherAccount.id);

    await harness.accountRepository.insert(otherAccount);
    await harness.profileRepository.insert(otherProfile);

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${otherProfile.id}/progress`, {
        headers: {
          authorization: 'Bearer dev:owner'
        }
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'not_found',
        message: 'Profile not found'
      }
    });
  });

  test('blocks cross-account event ingestion', async () => {
    const otherAccount = createAccount();
    const otherProfile = createProfile(otherAccount.id);

    await harness.accountRepository.insert(otherAccount);
    await harness.profileRepository.insert(otherProfile);

    const response = await harness.server.handle(
      new Request(`http://test/profiles/${otherProfile.id}/events`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev:owner',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          events: [
            {
              clientEventId: 'event-1',
              eventType: 'response.recorded',
              occurredAt: '2026-04-15T12:00:00.000Z',
              schemaVersion: 1,
              payload: {
                itemId: 'match-m'
              }
            }
          ]
        })
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'not_found',
        message: 'Profile not found'
      }
    });
  });
});
