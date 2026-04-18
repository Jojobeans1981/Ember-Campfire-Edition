import { skillState, store } from '../store';

const STORAGE_KEY = 'ember-campground-save-v3';
const memoryStorage = new Map();

function cloneJsonSafe(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasStorageMethod(name) {
  return (
    typeof globalThis.localStorage !== 'undefined'
    && typeof globalThis.localStorage[name] === 'function'
  );
}

function readState() {
  try {
    const raw = hasStorageMethod('getItem')
      ? globalThis.localStorage.getItem(STORAGE_KEY)
      : (memoryStorage.has(STORAGE_KEY) ? memoryStorage.get(STORAGE_KEY) : null);

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

function writeState(nextState) {
  const raw = JSON.stringify(nextState);
  if (hasStorageMethod('setItem')) {
    globalThis.localStorage.setItem(STORAGE_KEY, raw);
    return;
  }

  memoryStorage.set(STORAGE_KEY, raw);
}

function removeState() {
  if (hasStorageMethod('removeItem')) {
    globalThis.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  memoryStorage.delete(STORAGE_KEY);
}

function createProfileCacheKey(profileId) {
  return String(profileId ?? '');
}

function createScopeKey(accountId = store.currentUser?.accountId ?? store.account?.id) {
  return accountId ? `account:${accountId}` : 'local';
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
  function saveBootstrapState(options = {}) {
    try {
      const scopeKey = createScopeKey(options.accountId);
      if (!scopeKey) {
        return;
      }

      const persisted = readState();
      const bootstrapCaches = persisted.bootstrapCaches ?? {};
      bootstrapCaches[scopeKey] = {
        activeProfileId: store.activeProfileId ?? null,
        bootstrapCache: {
          currentUser: store.currentUser,
          account: store.account,
          profiles: Array.isArray(store.profiles) ? [...store.profiles] : [],
          savedAt: new Date().toISOString(),
        },
      };
      persisted.bootstrapCaches = bootstrapCaches;
      persisted.lastBootstrapScopeKey = scopeKey;
      writeState(persisted);
    } catch (err) {
      console.warn('Failed to save bootstrap state:', err);
    }
  }

  function loadBootstrapState(options = {}) {
    const persisted = readState();
    const scopeKey = options.accountId ? createScopeKey(options.accountId) : persisted.lastBootstrapScopeKey;
    if (!scopeKey) {
      if (persisted.bootstrapCache) {
        return {
          activeProfileId: persisted.activeProfileId ?? null,
          bootstrapCache: persisted.bootstrapCache ?? null,
        };
      }

      return {
        activeProfileId: null,
        bootstrapCache: null,
      };
    }

    const cachedState = persisted.bootstrapCaches?.[scopeKey] ?? null;
    return {
      activeProfileId: cachedState?.activeProfileId ?? null,
      bootstrapCache: cachedState?.bootstrapCache ?? null,
    };
  }

  function clearBootstrapState(options = {}) {
    try {
      const persisted = readState();
      const scopeKey = options.accountId ? createScopeKey(options.accountId) : null;

      if (!scopeKey) {
        delete persisted.bootstrapCaches;
        delete persisted.lastBootstrapScopeKey;
        delete persisted.activeProfileId;
        delete persisted.bootstrapCache;
      } else if (persisted.bootstrapCaches) {
        delete persisted.bootstrapCaches[scopeKey];
        if (persisted.lastBootstrapScopeKey === scopeKey) {
          delete persisted.lastBootstrapScopeKey;
        }
      }
      writeState(persisted);
    } catch (err) {
      console.warn('Failed to clear bootstrap state:', err);
    }
  }

  function saveProfileState(profileId = store.activeProfileId, overrides = {}) {
    try {
      if (!profileId) {
        return;
      }

      const scopeKey = createScopeKey();
      if (!scopeKey) {
        return;
      }

      const persisted = readState();
      const profileStates = persisted.profileStates ?? {};
      const scopedProfileStates = profileStates[scopeKey] ?? {};
      scopedProfileStates[createProfileCacheKey(profileId)] = {
        snapshot: cloneJsonSafe(overrides.snapshot) ?? createSnapshotCache(profileId),
        pendingOperations: cloneJsonSafe(overrides.pendingOperations) ?? [...store.pendingOperations],
        savedAt: new Date().toISOString(),
      };
      profileStates[scopeKey] = scopedProfileStates;
      persisted.profileStates = profileStates;
      writeState(persisted);
    } catch (err) {
      console.warn('Failed to save profile state:', err);
    }
  }

  function loadProfileState(profileId, options = {}) {
    const scopeKey = createScopeKey(options.accountId);
    if (!scopeKey) {
      return null;
    }

    const persisted = readState();
    const profileStates = persisted.profileStates?.[scopeKey] ?? {};
    return profileStates[createProfileCacheKey(profileId)] ?? null;
  }

  function clearProfileState(profileId, options = {}) {
    try {
      const scopeKey = createScopeKey(options.accountId);
      if (!scopeKey) {
        return;
      }

      const persisted = readState();
      if (!persisted.profileStates?.[scopeKey]) {
        return;
      }

      delete persisted.profileStates[scopeKey][createProfileCacheKey(profileId)];
      writeState(persisted);
    } catch (err) {
      console.warn('Failed to clear profile state:', err);
    }
  }

  function clearSave() {
    removeState();
  }

  return {
    saveBootstrapState,
    loadBootstrapState,
    clearBootstrapState,
    createScopeKey,
    saveProfileState,
    loadProfileState,
    clearProfileState,
    clearSave,
  };
}
