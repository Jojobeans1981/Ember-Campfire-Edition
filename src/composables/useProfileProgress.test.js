import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearBootstrapState, replaceSkillState, skillState, store } from '../store';
import { usePersistence } from './usePersistence.js';
import { useProfileProgress } from './useProfileProgress.js';

vi.mock('./useAuthSession.js', () => ({
  useAuthSession: () => ({
    mode: 'dev',
    getBearerToken: async () => 'dev:owner',
    handleUnauthorizedResponse: async () => false,
    isAuthenticated: () => true,
  }),
}));

function createJsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function createSnapshot(profileId, overrides = {}) {
  return {
    profileId,
    version: 0,
    ufliProgress: {},
    xp: 0,
    selectedFriend: null,
    skillState: {},
    skillStateSchemaVersion: 1,
    updatedAt: '2026-04-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('useProfileProgress', () => {
  beforeEach(() => {
    clearBootstrapState();
    store.activeProfileId = 'profile-1';
    localStorage.clear();
    vi.restoreAllMocks();
    let operationId = 0;
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => `op-${++operationId}`),
    });
  });

  it('hydrates server snapshot and resumes pending operations from cache', async () => {
    const persistence = usePersistence();

    store.activeProfileId = 'profile-1';
    store.version = 3;
    store.xp = 150;
    store.ufliProgress['001'] = {
      lessonComplete: true,
      activitiesComplete: { speech: true },
      connectedTextRead: false,
    };
    replaceSkillState({ decoding: { streak: 2 } }, 2);
    store.pendingOperations.push({
      clientOperationId: 'pending-1',
      type: 'set_selected_friend',
      payload: {
        selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
      },
      createdAt: '2026-04-15T12:01:00.000Z',
    });
    persistence.saveProfileState('profile-1');

    clearBootstrapState();
    store.activeProfileId = 'profile-1';

    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress') && (!options.method || options.method === 'GET')) {
        return createJsonResponse(200, createSnapshot('profile-1', {
          version: 4,
          xp: 200,
          ufliProgress: {
            '001': {
              lessonComplete: true,
              activitiesComplete: { speech: true, match: true },
              connectedTextRead: false,
            },
          },
          skillState: { decoding: { streak: 4 } },
          skillStateSchemaVersion: 3,
        }));
      }

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return createJsonResponse(200, {
          profileId: 'profile-1',
          startingVersion: 4,
          endingVersion: 5,
          applied: [{ clientOperationId: 'pending-1', appliedVersion: 5 }],
          rejected: [],
          snapshot: createSnapshot('profile-1', {
            version: 5,
            xp: 200,
            selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
            ufliProgress: {
              '001': {
                lessonComplete: true,
                activitiesComplete: { speech: true, match: true },
                connectedTextRead: false,
              },
            },
            skillState: { decoding: { streak: 4 } },
            skillStateSchemaVersion: 3,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { bootstrapProfileProgress } = useProfileProgress();
    await bootstrapProfileProgress('profile-1');

    expect(store.version).toBe(5);
    expect(store.xp).toBe(200);
    expect(store.selectedFriend).toEqual({ id: 'fox', name: 'Fox', file: 'fox.png' });
    expect(store.pendingOperations).toEqual([]);
    expect(store.syncStatus).toBe('idle');
    expect(skillState.decoding).toEqual({ streak: 4 });
  });

  it('guards the snapshot recovery path so only explicit repair flows can use it', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { recoverProfileProgress } = useProfileProgress();

    await expect(recoverProfileProgress('profile-1', createSnapshot('profile-1'))).rejects.toThrow(
      'Progress snapshot recovery is reserved for explicit repair flows.'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces optimistic state with the canonical snapshot after a successful flush', async () => {
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return createJsonResponse(200, {
          profileId: 'profile-1',
          startingVersion: 0,
          endingVersion: 1,
          applied: [{ clientOperationId: 'op-1', appliedVersion: 1 }],
          rejected: [],
          snapshot: createSnapshot('profile-1', {
            version: 1,
            xp: 100,
            ufliProgress: {
              '001': {
                lessonComplete: true,
                activitiesComplete: {
                  speech: false,
                  match: false,
                  blend: false,
                  build: false,
                  sentence: false,
                },
                connectedTextRead: false,
              },
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitOperation } = useProfileProgress();
    await submitOperation('complete_lesson', { lessonId: '001' });

    expect(store.version).toBe(1);
    expect(store.xp).toBe(100);
    expect(store.pendingOperations).toEqual([]);
    expect(store.syncStatus).toBe('idle');
    expect(store.ufliProgress['001'].lessonComplete).toBe(true);
  });

  it('routes skill state edits through replace_skill_state operations', async () => {
    replaceSkillState({ decoding: { streak: 2, currentSupportLevel: 'guided' } }, 3);

    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        const body = JSON.parse(options.body ?? '{}');

        expect(body.operations).toHaveLength(1);
        expect(body.operations[0]).toMatchObject({
          type: 'replace_skill_state',
          payload: {
            skillStateSchemaVersion: 3,
            skillState: {
              decoding: {
                streak: 4,
                currentSupportLevel: 'guided',
              },
            },
          },
        });

        return createJsonResponse(200, {
          profileId: 'profile-1',
          startingVersion: 0,
          endingVersion: 1,
          applied: [{ clientOperationId: 'op-1', appliedVersion: 1 }],
          rejected: [],
          snapshot: createSnapshot('profile-1', {
            version: 1,
            xp: 0,
            skillState: {
              decoding: {
                streak: 4,
                currentSupportLevel: 'guided',
              },
            },
            skillStateSchemaVersion: 3,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitSkillStateUpdate } = useProfileProgress();
    await submitSkillStateUpdate((nextSkillState) => {
      nextSkillState.decoding.streak = 4;
    });

    expect(skillState.decoding).toEqual({ streak: 4, currentSupportLevel: 'guided' });
    expect(store.skillStateSchemaVersion).toBe(3);
    expect(store.pendingOperations).toEqual([]);
  });

  it('never uses the snapshot endpoint during normal progression sync', async () => {
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress-snapshot')) {
        throw new Error('Normal sync must not call recovery snapshot writes');
      }

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return createJsonResponse(200, {
          profileId: 'profile-1',
          startingVersion: 0,
          endingVersion: 1,
          applied: [{ clientOperationId: 'op-1', appliedVersion: 1 }],
          rejected: [],
          snapshot: createSnapshot('profile-1', {
            version: 1,
            xp: 100,
            ufliProgress: {
              '001': {
                lessonComplete: true,
                activitiesComplete: {},
                connectedTextRead: false,
              },
            },
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitOperation } = useProfileProgress();
    await submitOperation('complete_lesson', { lessonId: '001' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/profiles/profile-1/progress-operations');
  });

  it('reapplies cached queued operations after bootstrap hydration when the flush fails', async () => {
    const persistence = usePersistence();

    store.activeProfileId = 'profile-1';
    store.selectedFriend = { id: 'fox', name: 'Fox', file: 'fox.png' };
    store.pendingOperations.push({
      clientOperationId: 'pending-1',
      type: 'set_selected_friend',
      payload: {
        selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
      },
      createdAt: '2026-04-15T12:01:00.000Z',
    });
    persistence.saveProfileState('profile-1');

    clearBootstrapState();

    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress') && (!options.method || options.method === 'GET')) {
        return createJsonResponse(200, createSnapshot('profile-1'));
      }

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return Promise.reject(new Error('Network unavailable'));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { bootstrapProfileProgress } = useProfileProgress();
    await expect(bootstrapProfileProgress('profile-1')).rejects.toThrow('Network unavailable');

    expect(store.selectedFriend).toEqual({ id: 'fox', name: 'Fox', file: 'fox.png' });
    expect(store.pendingOperations).toHaveLength(1);
    expect(store.syncStatus).toBe('error');
    expect(store.lastSyncError).toContain('Network unavailable');
  });

  it('surfaces recovery conflicts and falls back to the server snapshot', async () => {
    const persistence = usePersistence();

    store.activeProfileId = 'profile-1';
    store.version = 3;
    store.xp = 275;
    store.ufliProgress['001'] = {
      lessonComplete: true,
      activitiesComplete: { speech: true, match: true },
      connectedTextRead: true,
    };
    persistence.saveProfileState('profile-1');

    clearBootstrapState();

    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress') && (!options.method || options.method === 'GET')) {
        return createJsonResponse(200, createSnapshot('profile-1', {
          version: 2,
          xp: 150,
          ufliProgress: {
            '001': {
              lessonComplete: true,
              activitiesComplete: { speech: true },
              connectedTextRead: false,
            },
          },
        }));
      }

      if (url.endsWith('/profiles/profile-1/progress-snapshot') && options.method === 'PUT') {
        return createJsonResponse(409, {
          error: {
            code: 'conflict',
            message: 'Progress snapshot is stale against the current server version.',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { bootstrapProfileProgress } = useProfileProgress();
    await bootstrapProfileProgress('profile-1');

    expect(store.version).toBe(2);
    expect(store.xp).toBe(150);
    expect(store.lastRecoveryError).toBe(
      'A newer server snapshot already exists, so the local repair copy was skipped.'
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('/profiles/profile-1/progress-snapshot');
  });

  it('keeps retryable operations queued and surfaces partial-success errors', async () => {
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return createJsonResponse(200, {
          profileId: 'profile-1',
          startingVersion: 0,
          endingVersion: 1,
          applied: [{ clientOperationId: 'op-1', appliedVersion: 1 }],
          rejected: [{
            clientOperationId: 'op-2',
            code: 'conflict',
            message: 'Operation is stale against newer server skill state.',
          }],
          snapshot: createSnapshot('profile-1', {
            version: 1,
            xp: 100,
            ufliProgress: {
              '001': {
                lessonComplete: true,
                activitiesComplete: {},
                connectedTextRead: false,
              },
            },
            skillState: { decoding: { streak: 8 } },
            skillStateSchemaVersion: 2,
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitOperation } = useProfileProgress();
    await submitOperation('complete_lesson', { lessonId: '001' });
    await submitOperation('replace_skill_state', {
      skillState: { decoding: { streak: 99 } },
      skillStateSchemaVersion: 9,
    }).catch(() => undefined);

    expect(store.version).toBe(1);
    expect(store.xp).toBe(100);
    expect(store.skillStateSchemaVersion).toBe(2);
    expect(skillState.decoding).toEqual({ streak: 8 });
    expect(store.lastSyncError).toContain('stale against newer server skill state');
    expect(store.syncStatus).toBe('error');
    expect(store.pendingOperations).toEqual([]);
  });

  it('dedupes in-flight flushes and keeps local progress queued on transport failure', async () => {
    let resolveRequest;
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/progress-operations')) {
        return new Promise((resolve) => {
          resolveRequest = () => resolve(createJsonResponse(200, {
            profileId: 'profile-1',
            startingVersion: 0,
            endingVersion: 1,
            applied: [{ clientOperationId: 'op-1', appliedVersion: 1 }],
            rejected: [],
            snapshot: createSnapshot('profile-1', {
              version: 1,
              xp: 100,
              ufliProgress: {
                '001': {
                  lessonComplete: true,
                  activitiesComplete: {},
                  connectedTextRead: false,
                },
              },
            }),
          }));
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitOperation, flushPendingOperations } = useProfileProgress();
    const submitPromise = submitOperation('complete_lesson', { lessonId: '001' });
    const secondFlushPromise = flushPendingOperations();

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(secondFlushPromise).toBeInstanceOf(Promise);

    resolveRequest();
    await submitPromise;

    expect(store.pendingOperations).toEqual([]);
    expect(store.version).toBe(1);
  });

  it('automatically flushes operations queued during an in-flight request', async () => {
    let firstRequestResolve;
    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (!url.endsWith('/profiles/profile-1/progress-operations')) {
        throw new Error(`Unexpected fetch: ${url}`);
      }

      const body = JSON.parse(options.body ?? '{}');

      if (fetchMock.mock.calls.length === 1) {
        return new Promise((resolve) => {
          firstRequestResolve = () => resolve(createJsonResponse(200, {
            profileId: 'profile-1',
            startingVersion: 0,
            endingVersion: 1,
            applied: [{ clientOperationId: body.operations[0].clientOperationId, appliedVersion: 1 }],
            rejected: [],
            snapshot: createSnapshot('profile-1', {
              version: 1,
              xp: 100,
              ufliProgress: {
                '001': {
                  lessonComplete: true,
                  activitiesComplete: {},
                  connectedTextRead: false,
                },
              },
            }),
          }));
        });
      }

      return createJsonResponse(200, {
        profileId: 'profile-1',
        startingVersion: 1,
        endingVersion: 2,
        applied: [{ clientOperationId: body.operations[0].clientOperationId, appliedVersion: 2 }],
        rejected: [],
        snapshot: createSnapshot('profile-1', {
          version: 2,
          xp: 100,
          selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
          ufliProgress: {
            '001': {
              lessonComplete: true,
              activitiesComplete: {},
              connectedTextRead: false,
            },
          },
        }),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const { submitOperation } = useProfileProgress();
    const firstSubmitPromise = submitOperation('complete_lesson', { lessonId: '001' });
    const secondSubmitPromise = submitOperation('set_selected_friend', {
      selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    firstRequestResolve();
    await Promise.all([firstSubmitPromise, secondSubmitPromise]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(store.version).toBe(2);
    expect(store.selectedFriend).toEqual({ id: 'fox', name: 'Fox', file: 'fox.png' });
    expect(store.pendingOperations).toEqual([]);
    expect(store.syncStatus).toBe('idle');
  });
});
