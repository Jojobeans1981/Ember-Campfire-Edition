import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearBootstrapState, store } from '../store';
import { usePersistence } from './usePersistence.js';

const bootstrapProfileProgressMock = vi.fn();

vi.mock('./useProfileProgress.js', () => ({
  useProfileProgress: () => ({
    bootstrapProfileProgress: bootstrapProfileProgressMock,
  }),
}));

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

function createDevIdentityKey(token) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) - hash) + token.charCodeAt(index);
    hash |= 0;
  }

  return `token-${Math.abs(hash).toString(36)}`;
}

describe('useAppBootstrap', () => {
  beforeEach(() => {
    clearBootstrapState();
    localStorage.clear();
    vi.restoreAllMocks();
    bootstrapProfileProgressMock.mockReset();
    bootstrapProfileProgressMock.mockResolvedValue(undefined);
  });

  it('returns the zero-profile creation state without bootstrapping progress', async () => {
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, { id: 'user-1', accountId: 'account-1' });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, { id: 'account-1', name: 'Dev Household', type: 'family' });
      }

      if (url.endsWith('/profiles')) {
        return createJsonResponse(200, []);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { useAppBootstrap } = await import('./useAppBootstrap.js');
    const result = await useAppBootstrap().bootstrapApp();

    expect(result).toEqual({
      unauthenticated: false,
      requiresProfileSelection: false,
      requiresProfileCreation: true,
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:3001/me',
      'http://127.0.0.1:3001/account',
      'http://127.0.0.1:3001/profiles',
    ]);
    expect(store.bootstrapStatus).toBe('ready');
    expect(store.activeProfileId).toBeNull();
    expect(bootstrapProfileProgressMock).not.toHaveBeenCalled();
  });

  it('reuses a persisted active profile for multi-profile households when it is still valid', async () => {
    const persistence = usePersistence();
    store.activeProfileId = 'profile-2';
    store.currentUser = { id: 'cached-user', accountId: 'account-1' };
    store.account = { id: 'account-1' };
    store.profiles.splice(0, store.profiles.length, { id: 'profile-2', name: 'Cached Piper' });
    persistence.saveBootstrapState({ devIdentityKey: createDevIdentityKey('dev:owner') });

    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, { id: 'user-1', accountId: 'account-1' });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, { id: 'account-1', name: 'Dev Household', type: 'family' });
      }

      if (url.endsWith('/profiles')) {
        return createJsonResponse(200, [
          { id: 'profile-1', name: 'Ember' },
          { id: 'profile-2', name: 'Piper' },
        ]);
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { useAppBootstrap } = await import('./useAppBootstrap.js');
    const result = await useAppBootstrap().bootstrapApp();

    expect(result).toEqual({
      unauthenticated: false,
      requiresProfileSelection: false,
      requiresProfileCreation: false,
    });
    expect(store.activeProfileId).toBe('profile-2');
    expect(bootstrapProfileProgressMock).toHaveBeenCalledWith('profile-2');
  });

  it('clears only the failed bootstrap scope after an unauthenticated response', async () => {
    const devScopeKey = `dev:${createDevIdentityKey('dev:owner')}`;

    localStorage.setItem('ember-campground-save-v3', JSON.stringify({
      lastBootstrapScopeKey: devScopeKey,
      bootstrapCaches: {
        [devScopeKey]: {
          activeProfileId: 'profile-1',
          bootstrapCache: {
            currentUser: { id: 'cached-user', accountId: 'dev-account' },
            account: { id: 'dev-account' },
            profiles: [{ id: 'profile-1', name: 'Cached Ember' }],
          },
        },
        'account:other-account': {
          activeProfileId: 'profile-2',
          bootstrapCache: {
            currentUser: { id: 'other-user', accountId: 'other-account' },
            account: { id: 'other-account' },
            profiles: [{ id: 'profile-2', name: 'Other Ember' }],
          },
        },
      },
      bootstrapCache: {
        currentUser: { id: 'legacy-user', accountId: 'legacy-account' },
        account: { id: 'legacy-account' },
        profiles: [{ id: 'legacy-profile', name: 'Legacy Ember' }],
      },
      activeProfileId: 'legacy-profile',
    }));

    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(401, {
      error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
    })));

    const { useAppBootstrap } = await import('./useAppBootstrap.js');
    const result = await useAppBootstrap().bootstrapApp();

    expect(result).toEqual({ unauthenticated: true });
    expect(store.bootstrapStatus).toBe('unauthenticated');
    expect(store.currentUser).toBeNull();
    expect(store.activeProfileId).toBeNull();
    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toEqual({
      bootstrapCaches: {
        'account:other-account': {
          activeProfileId: 'profile-2',
          bootstrapCache: {
            currentUser: { id: 'other-user', accountId: 'other-account' },
            account: { id: 'other-account' },
            profiles: [{ id: 'profile-2', name: 'Other Ember' }],
          },
        },
      },
      bootstrapCache: {
        currentUser: { id: 'legacy-user', accountId: 'legacy-account' },
        account: { id: 'legacy-account' },
        profiles: [{ id: 'legacy-profile', name: 'Legacy Ember' }],
      },
      activeProfileId: 'legacy-profile',
    });
  });
});
