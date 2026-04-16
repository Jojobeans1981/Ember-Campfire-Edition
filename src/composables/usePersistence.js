import { skillState, store } from '../store';

const STORAGE_KEY = 'ember-campground-save-v3';

function cloneJsonSafe(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Failed to read persisted state:', err);
    return {};
  }
}

function writeStorage(nextState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function createProfileCacheKey(profileId) {
  return String(profileId ?? '');
}

function createSnapshotCache(profileId = store.activeProfileId) {
  return {
    profileId,
    version: store.version,
    ufliProgress: cloneJsonSafe(store.ufliProgress) ?? {},
    xp: store.xp,
    selectedFriend: cloneJsonSafe(store.selectedFriend),
    skillState: cloneJsonSafe(skillState) ?? {},
    skillStateSchemaVersion: store.skillStateSchemaVersion,
    updatedAt: store.updatedAt,
  };
}

export function usePersistence() {
  function saveBootstrapState() {
    try {
      const persisted = readStorage();
      persisted.activeProfileId = store.activeProfileId ?? null;
      persisted.bootstrapCache = {
        currentUser: store.currentUser,
        account: store.account,
        profiles: Array.isArray(store.profiles) ? [...store.profiles] : [],
        savedAt: new Date().toISOString(),
      };
      writeStorage(persisted);
    } catch (err) {
      console.warn('Failed to save bootstrap state:', err);
    }
  }

  function loadBootstrapState() {
    const persisted = readStorage();
    return {
      activeProfileId: persisted.activeProfileId ?? null,
      bootstrapCache: persisted.bootstrapCache ?? null,
    };
  }

  function clearBootstrapState() {
    try {
      const persisted = readStorage();
      delete persisted.activeProfileId;
      delete persisted.bootstrapCache;
      writeStorage(persisted);
    } catch (err) {
      console.warn('Failed to clear bootstrap state:', err);
    }
  }

  function saveProfileState(profileId = store.activeProfileId, overrides = {}) {
    try {
      if (!profileId) {
        return;
      }

      const persisted = readStorage();
      const profileStates = persisted.profileStates ?? {};
      profileStates[createProfileCacheKey(profileId)] = {
        snapshot: cloneJsonSafe(overrides.snapshot) ?? createSnapshotCache(profileId),
        pendingOperations: cloneJsonSafe(overrides.pendingOperations) ?? [...store.pendingOperations],
        savedAt: new Date().toISOString(),
      };
      persisted.profileStates = profileStates;
      writeStorage(persisted);
    } catch (err) {
      console.warn('Failed to save profile state:', err);
    }
  }

  function loadProfileState(profileId) {
    const persisted = readStorage();
    const profileStates = persisted.profileStates ?? {};
    return profileStates[createProfileCacheKey(profileId)] ?? null;
  }

  function clearProfileState(profileId) {
    try {
      const persisted = readStorage();
      if (!persisted.profileStates) {
        return;
      }

      delete persisted.profileStates[createProfileCacheKey(profileId)];
      writeStorage(persisted);
    } catch (err) {
      console.warn('Failed to clear profile state:', err);
    }
  }

  function clearSave() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    saveBootstrapState,
    loadBootstrapState,
    clearBootstrapState,
    saveProfileState,
    loadProfileState,
    clearProfileState,
    clearSave,
  };
}
