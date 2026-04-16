import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import App from './App.vue';
import { clearBootstrapState, store } from './store';

vi.mock('./composables/useEmber.js', () => ({
  stopAllAudio: vi.fn(),
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
    ACTIVITY_TYPES: ['speech', 'match', 'blend', 'build', 'sentence'],
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
    vi.restoreAllMocks();
  });

  it('boots authenticated users, auto-selects a single profile, and enters the main flow without a guardian choice', async () => {
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
    expect(store.currentPage).toBe('campground');
    expect(wrapper.find('[data-test="campground-map"]').exists()).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'http://127.0.0.1:3001/me',
      'http://127.0.0.1:3001/account',
      'http://127.0.0.1:3001/profiles',
      'http://127.0.0.1:3001/profiles/profile-1/progress',
    ]);

    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toMatchObject({
      activeProfileId: 'profile-1',
      bootstrapCache: {
        currentUser: { id: 'user-1' },
        account: { id: 'account-1' },
        profiles: [{ id: 'profile-1', name: 'Ember' }],
      },
    });
  });

  it('shows the unauthenticated state when bootstrap receives 401 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(401, {
      error: { message: 'Unauthorized', code: 'AUTH_UNAUTHORIZED' },
    })));

    localStorage.setItem('ember-campground-save-v3', JSON.stringify({
      activeProfileId: 'profile-1',
      bootstrapCache: {
        currentUser: { id: 'cached-user' },
        account: { id: 'cached-account' },
        profiles: [{ id: 'profile-1', name: 'Cached Ember' }],
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
    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toEqual({});
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

    localStorage.setItem('ember-campground-save-v3', JSON.stringify({
      activeProfileId: 'missing-profile',
    }));

    const wrapper = mountApp();
    await flushPromises();
    await flushPromises();

    expect(store.bootstrapStatus).toBe('ready');
    expect(store.activeProfileId).toBeNull();
    expect(store.currentPage).toBe('selection');
    expect(wrapper.text()).toContain('Choose a Reader');
    expect(JSON.parse(localStorage.getItem('ember-campground-save-v3'))).toMatchObject({
      activeProfileId: null,
    });

    await wrapper.findAll('.profile-card')[1].trigger('click');
    await flushPromises();
    await flushPromises();

    expect(store.activeProfileId).toBe('profile-2');
    expect(store.xp).toBe(100);
    expect(store.currentPage).toBe('campground');
    expect(wrapper.find('[data-test="campground-map"]').exists()).toBe(true);
  });

  it('shows profile creation when no profiles exist and enters the main flow after creating one', async () => {
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
    expect(store.currentPage).toBe('campground');
    expect(wrapper.find('[data-test="campground-map"]').exists()).toBe(true);
  });
});
