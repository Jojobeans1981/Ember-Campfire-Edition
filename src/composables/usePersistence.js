import { store, skillState } from '../store';

const STORAGE_KEY = 'ember-campground-save';

export function usePersistence() {
  function save() {
    try {
      const data = {
        unitProgress: store.unitProgress,
        xp: store.xp,
        selectedFriend: store.selectedFriend,
        skillState: { ...skillState },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Failed to save progress:', err);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.unitProgress) {
        Object.assign(store.unitProgress, data.unitProgress);
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
    localStorage.removeItem(STORAGE_KEY);
  }

  return { save, load, clearSave };
}
