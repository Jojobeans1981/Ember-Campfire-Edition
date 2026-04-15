import { store, skillState } from '../store';

const STORAGE_KEY = 'ember-campground-save';
const memoryStorage = new Map();

function hasStorageMethod(name) {
  return (
    typeof globalThis.localStorage !== 'undefined' &&
    typeof globalThis.localStorage[name] === 'function'
  );
}

function writeStorage(key, value) {
  if (hasStorageMethod('setItem')) {
    globalThis.localStorage.setItem(key, value);
    return;
  }
  memoryStorage.set(key, value);
}

function readStorage(key) {
  if (hasStorageMethod('getItem')) {
    return globalThis.localStorage.getItem(key);
  }
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
}

function removeStorage(key) {
  if (hasStorageMethod('removeItem')) {
    globalThis.localStorage.removeItem(key);
    return;
  }
  memoryStorage.delete(key);
}

export function usePersistence() {
  function save() {
    try {
      const data = {
        ufliProgress: store.ufliProgress,
        xp: store.xp,
        selectedFriend: store.selectedFriend,
        skillState: { ...skillState },
      };
      writeStorage(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save progress:', err);
    }
  }

  function load() {
    try {
      const raw = readStorage(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.ufliProgress) {
        Object.assign(store.ufliProgress, data.ufliProgress);
      }
      if (typeof data.xp === 'number') {
        store.xp = data.xp;
      }
      if (data.selectedFriend) {
        store.selectedFriend = data.selectedFriend;
      }
      if (data.skillState) {
        Object.assign(skillState, data.skillState);
      }
      return true;
    } catch (err) {
      console.warn('Failed to load saved progress:', err);
      return false;
    }
  }

  function clearSave() {
    removeStorage(STORAGE_KEY);
  }

  return { save, load, clearSave };
}
