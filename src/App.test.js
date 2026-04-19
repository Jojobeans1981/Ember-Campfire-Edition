import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from './App.vue';
import { clearBootstrapState, store } from './store';

const SPLASH_SEEN_KEY = 'ember-splash-seen';

vi.mock('./composables/useEmber.js', () => ({
  stopAllAudio: vi.fn(),
  preloadEmberVoice: vi.fn(),
  useEmber: () => ({
    speak: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./composables/useSpeechRecognition.js', () => ({
  useSpeechRecognition: () => ({
    cancelListening: vi.fn(),
  }),
}));

vi.mock('./composables/useCelebration.js', () => ({
  celebrateComplete: vi.fn(),
  celebrateFireLit: vi.fn(),
  celebrateStory: vi.fn(),
  celebrateUnitComplete: vi.fn(),
}));

vi.mock('./composables/useUfliProgression.js', () => ({
  useUfliProgression: () => ({
    completeUfliLesson: vi.fn().mockResolvedValue(null),
    completeUfliActivity: vi.fn().mockResolvedValue(null),
    completeUfliConnectedText: vi.fn().mockResolvedValue(null),
    getUfliLessonStatus: vi.fn().mockReturnValue('kindling'),
    isUfliConnectedTextUnlocked: vi.fn().mockReturnValue(false),
    ACTIVITY_TYPES: ['speech', 'match', 'blend', 'build', 'sentence'],
  }),
}));

vi.mock('./composables/useAuthSession.js', () => ({
  useAuthSession: () => ({
    mode: 'dev',
    getBearerToken: async () => 'dev:owner',
    handleUnauthorizedResponse: async () => false,
    initializeSession: async () => true,
    isAuthenticated: () => true,
    logout: vi.fn(),
    startLogin: vi.fn(),
  }),
}));

function createJsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function createProgressSnapshot(profileId, overrides = {}) {
  return {
    profileId,
    version: 0,
    ufliProgress: {},
    xp: 0,
    selectedFriend: null,
    skillState: {},
    skillStateSchemaVersion: 1,
    updatedAt: null,
    ...overrides,
  };
}

function createDevIdentityKey(token) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) - hash) + token.charCodeAt(index);
    hash |= 0;
  }

  return `token-${Math.abs(hash).toString(36)}`;
}

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        CampgroundMap: { template: '<div data-test="campground-map">Campground Map</div>' },
        UfliLessonHub: true,
        LessonPlayer: true,
        ActivityPlayer: true,
        StoryReader: true,
        Dashboard: true,
      },
    },
  });
}

describe('App bootstrap', () => {
  beforeEach(() => {
    clearBootstrapState();
    store.currentPage = 'selection';
    store.activeLessonId = null;
    store.activeActivity = null;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(SPLASH_SEEN_KEY, '1');
    vi.restoreAllMocks();
  });

  it('boots authenticated users, auto-selects a single profile, and waits for a guardian choice before entering the campground', async () => {
    const devScopeKey = `dev:${createDevIdentityKey('dev:owner')}`;

    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, {
          id: 'user-1',
          accountId: 'account-1',
          email: 'owner@dev.local',
          displayName: 'Dev Owner',
          role: 'owner',
        });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, {
          id: 'account-1',
          name: 'Dev Household',
          type: 'family',
        });
      }

      if (url.endsWith('/profiles')) {
        return createJsonResponse(200, [{ id: 'profile-1', name: 'Ember' }]);
      }

      if (url.endsWith('/profiles/profile-1/progress')) {
        return createJsonResponse(200, createProgressSnapshot('profile-1'));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(store.bootstrapStatus).toBe('ready');
    expect(store.currentUser).toMatchObject({ id: 'user-1', accountId: 'account-1' });
    expect(store.account).toMatchObject({ id: 'account-1' });
    expect(store.activeProfileId).toBe('profile-1');
    expect(store.currentPage).toBe('selection');
    expect(wrapper.findAll('.char-card')).toHaveLength(4);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:3001/me',
      'http://127.0.0.1:3001/account',
      'http://127.0.0.1:3001/profiles',
      'http://127.0.0.1:3001/profiles/profile-1/progress',
    ]);

    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toMatchObject({
      lastBootstrapScopeKey: devScopeKey,
      bootstrapCaches: {
        [devScopeKey]: {
          activeProfileId: 'profile-1',
          bootstrapCache: {
            currentUser: { id: 'user-1' },
            account: { id: 'account-1' },
            profiles: [{ id: 'profile-1', name: 'Ember' }],
          },
        },
      },
    });
  });

  it('shows the unauthenticated state when bootstrap receives 401 responses', async () => {
    const devScopeKey = `dev:${createDevIdentityKey('dev:owner')}`;

    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(401, {
      error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
    })));

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
    }));

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(store.bootstrapStatus).toBe('unauthenticated');
    expect(store.currentUser).toBeNull();
    expect(store.account).toBeNull();
    expect(store.activeProfileId).toBeNull();
    expect(wrapper.text()).toContain('Sign-In Needed');
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
    });
  });

  it('requires explicit profile selection when multiple profiles exist and clears an invalid persisted profile id', async () => {
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, {
          id: 'user-1',
          accountId: 'account-1',
          email: 'owner@dev.local',
          displayName: 'Dev Owner',
          role: 'owner',
        });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, {
          id: 'account-1',
          name: 'Dev Household',
          type: 'family',
        });
      }

      if (url.endsWith('/profiles')) {
        return createJsonResponse(200, [
          { id: 'profile-1', name: 'Ember' },
          { id: 'profile-2', name: 'Piper' },
        ]);
      }

      if (url.endsWith('/profiles/profile-2/progress')) {
        return createJsonResponse(200, createProgressSnapshot('profile-2', { xp: 100 }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const devScopeKey = `dev:${createDevIdentityKey('dev:owner')}`;
    localStorage.setItem('ember-campground-save-v3', JSON.stringify({
      lastBootstrapScopeKey: devScopeKey,
      bootstrapCaches: {
        [devScopeKey]: {
          activeProfileId: 'missing-profile',
          bootstrapCache: {
            currentUser: { id: 'user-1', accountId: 'dev-account' },
            account: { id: 'dev-account' },
            profiles: [],
          },
        },
      },
    }));

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(store.bootstrapStatus).toBe('ready');
    expect(store.activeProfileId).toBeNull();
    expect(store.currentPage).toBe('selection');
    expect(wrapper.text()).toContain('Choose a Reader');
    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toMatchObject({
      bootstrapCaches: {
        [devScopeKey]: {
          activeProfileId: null,
        },
      },
    });

    await wrapper.findAll('.profile-card')[1].trigger('click');
    await flushPromises();
    await flushPromises();

    expect(store.activeProfileId).toBe('profile-2');
    expect(store.xp).toBe(100);
    expect(store.currentPage).toBe('selection');
    expect(wrapper.findAll('.char-card')).toHaveLength(4);
  });

  it('shows profile creation when no profiles exist and returns to guardian selection after creating one', async () => {
    let profileCreated = false;
    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, {
          id: 'user-1',
          accountId: 'account-1',
          email: 'owner@dev.local',
          displayName: 'Dev Owner',
          role: 'owner',
        });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, {
          id: 'account-1',
          name: 'Dev Household',
          type: 'family',
        });
      }

      if (url.endsWith('/profiles') && (!options.method || options.method === 'GET')) {
        return createJsonResponse(200, profileCreated ? [{ id: 'profile-1', name: 'Ember' }] : []);
      }

      if (url.endsWith('/profiles') && options.method === 'POST') {
        profileCreated = true;
        return createJsonResponse(201, { id: 'profile-1', name: 'Ember' });
      }

      if (url.endsWith('/profiles/profile-1/progress')) {
        return createJsonResponse(200, createProgressSnapshot('profile-1'));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain('Create Profile');

    await wrapper.get('#profile-name').setValue('Ember');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    await flushPromises();

    expect(store.bootstrapStatus).toBe('ready');
    expect(store.activeProfileId).toBe('profile-1');
    expect(store.currentPage).toBe('selection');
    expect(wrapper.findAll('.char-card')).toHaveLength(4);
  });

  it('skips guardian reselection and back returns from learning pages to campground', async () => {
    const selectedFriend = { id: 'fox', name: 'Fox', file: 'fox_1984443.png' };
    const fetchMock = vi.fn((input) => {
      const url = String(input);

      if (url.endsWith('/me')) {
        return createJsonResponse(200, {
          id: 'user-1',
          accountId: 'account-1',
          email: 'owner@dev.local',
          displayName: 'Dev Owner',
          role: 'owner',
        });
      }

      if (url.endsWith('/account')) {
        return createJsonResponse(200, {
          id: 'account-1',
          name: 'Dev Household',
          type: 'family',
        });
      }

      if (url.endsWith('/profiles')) {
        return createJsonResponse(200, [{ id: 'profile-1', name: 'Ember' }]);
      }

      if (url.endsWith('/profiles/profile-1/progress')) {
        return createJsonResponse(200, createProgressSnapshot('profile-1', { selectedFriend }));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(store.currentPage).toBe('campground');
    expect(store.selectedFriend).toEqual(selectedFriend);
    expect(wrapper.text()).toContain('Campground Map');
    expect(wrapper.find('.top-bar .nav-btn').exists()).toBe(false);

    for (const page of ['lesson', 'activity', 'story', 'dashboard']) {
      store.activeLessonId = '001';
      store.activeActivity = 'speech';
      store.currentPage = page;
      await flushPromises();
      expect(wrapper.find('.top-bar .nav-btn').exists()).toBe(true);
      await wrapper.get('.top-bar .nav-btn').trigger('click');
      await flushPromises();
      expect(store.currentPage).toBe('campground');
    }

    expect(wrapper.text()).not.toContain('Choose a Guardian');
  });
});
