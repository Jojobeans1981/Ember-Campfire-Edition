import { describe, it, expect, beforeEach } from 'vitest';
import { store } from './index';
import { usePersistence } from '../composables/usePersistence';

describe('Global Store', () => {
  beforeEach(() => {
    const { clearSave } = usePersistence();
    store.xp = 0;
    store.currentPage = 'selection';
    store.activeLessonId = null;
    for (const k of Object.keys(store.ufliProgress)) {
      delete store.ufliProgress[k];
    }
    clearSave();
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

describe('Persistence — ufliProgress round-trip', () => {
  beforeEach(() => {
    const { clearSave } = usePersistence();
    store.xp = 0;
    store.activeLessonId = null;
    for (const k of Object.keys(store.ufliProgress)) {
      delete store.ufliProgress[k];
    }
    clearSave();
  });

  it('saves and reloads ufliProgress', () => {
    const { save, load } = usePersistence();

    store.ufliProgress['001'] = {
      lessonComplete: true,
      activitiesComplete: {
        speech: true,
        match: true,
        blend: false,
        build: false,
        sentence: false,
      },
      connectedTextRead: false,
    };
    store.xp = 150;
    save();

    for (const k of Object.keys(store.ufliProgress)) {
      delete store.ufliProgress[k];
    }
    store.xp = 0;
    expect(store.ufliProgress['001']).toBeUndefined();

    load();
    expect(store.ufliProgress['001']).toBeDefined();
    expect(store.ufliProgress['001'].lessonComplete).toBe(true);
    expect(store.ufliProgress['001'].activitiesComplete.speech).toBe(true);
    expect(store.ufliProgress['001'].activitiesComplete.blend).toBe(false);
    expect(store.ufliProgress['001'].connectedTextRead).toBe(false);
    expect(store.xp).toBe(150);
  });

  it('preserves XP and selectedFriend across save/load (no regression)', () => {
    const { save, load } = usePersistence();
    store.xp = 275;
    store.selectedFriend = { name: 'Ember' };
    save();

    store.xp = 0;
    store.selectedFriend = null;
    load();

    expect(store.xp).toBe(275);
    expect(store.selectedFriend).toEqual({ name: 'Ember' });
  });
});
