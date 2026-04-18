import { describe, it, expect, beforeEach } from 'vitest';
import { store, clearBootstrapState, hydrateBootstrapState } from './index';
import { usePersistence } from '../composables/usePersistence';

function resetStoreForTest() {
  const { clearSave } = usePersistence();

  clearBootstrapState();
  store.currentPage = 'selection';
  store.activeLessonId = null;
  store.activeActivity = null;
  clearSave();
  localStorage.clear();
}

describe('Global Store', () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it('should initialize with 0 XP', () => {
    expect(store.xp).toBe(0);
  });

  it('should track UFLI lesson progress', () => {
    store.ufliProgress['001'] = {
      lessonComplete: false,
      activitiesComplete: {},
      connectedTextRead: false,
    };
    expect(store.ufliProgress['001'].lessonComplete).toBe(false);
    store.ufliProgress['001'].lessonComplete = true;
    expect(store.ufliProgress['001'].lessonComplete).toBe(true);
  });

  it('should support page navigation', () => {
    expect(store.currentPage).toBe('selection');
    store.currentPage = 'campground';
    expect(store.currentPage).toBe('campground');
    store.activeLessonId = '001';
    store.currentPage = 'unit-hub';
    expect(store.currentPage).toBe('unit-hub');
  });
});

describe('Persistence — bootstrap state', () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it('saves only bootstrap-safe auth and profile state', () => {
    const persistence = usePersistence();

    hydrateBootstrapState({
      currentUser: { id: 'user-1', accountId: 'account-1', displayName: 'Dev Owner' },
      account: { id: 'account-1', name: 'Dev Household', type: 'family' },
      profiles: [{ id: 'profile-1', name: 'Ember' }],
      activeProfileId: 'profile-1',
    });
    store.currentPage = 'campground';
    store.activeLessonId = '001';
    store.activeActivity = 'speech';
    store.xp = 275;
    store.selectedFriend = { id: 'fox', name: 'Fox', file: 'fox.png' };

    persistence.saveBootstrapState();

    expect(persistence.loadBootstrapState()).toEqual({
      activeProfileId: 'profile-1',
      bootstrapCache: {
        currentUser: { id: 'user-1', accountId: 'account-1', displayName: 'Dev Owner' },
        account: { id: 'account-1', name: 'Dev Household', type: 'family' },
        profiles: [{ id: 'profile-1', name: 'Ember' }],
        savedAt: expect.any(String),
      },
    });

    const raw = JSON.parse(localStorage.getItem('ember-campground-save-v3'));
    expect(raw.currentPage).toBeUndefined();
    expect(raw.activeLessonId).toBeUndefined();
    expect(raw.activeActivity).toBeUndefined();
    expect(raw.xp).toBeUndefined();
    expect(raw.selectedFriend).toBeUndefined();
    expect(raw.lastBootstrapScopeKey).toBe('account:account-1');
    expect(raw.bootstrapCaches['account:account-1'].activeProfileId).toBe('profile-1');
  });

  it('does not save bootstrap state when no account id is available', () => {
    const persistence = usePersistence();

    clearBootstrapState();
    store.currentUser = null;
    store.account = null;

    persistence.saveBootstrapState();

    expect(localStorage.getItem('ember-campground-save-v3')).toBeNull();
  });

  it('stores synced progress under profile-scoped caches instead of top-level app state', () => {
    const persistence = usePersistence();

    store.activeProfileId = 'profile-1';
    store.version = 4;
    store.xp = 275;
    store.selectedFriend = { id: 'fox', name: 'Fox', file: 'fox.png' };
    store.ufliProgress['001'] = {
      lessonComplete: true,
      activitiesComplete: { speech: true },
      connectedTextRead: false,
    };

    persistence.saveProfileState('profile-1');

    const raw = JSON.parse(localStorage.getItem('ember-campground-save-v3'));
    expect(raw.xp).toBeUndefined();
    expect(raw.ufliProgress).toBeUndefined();
    expect(raw.selectedFriend).toBeUndefined();
    expect(raw.profileStates.local['profile-1'].snapshot).toEqual({
      profileId: 'profile-1',
      version: 4,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: { speech: true },
          connectedTextRead: false,
        },
      },
      xp: 275,
      selectedFriend: { id: 'fox', name: 'Fox', file: 'fox.png' },
      skillState: {},
      skillStateSchemaVersion: 1,
      updatedAt: null,
    });
  });
});
