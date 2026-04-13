import { describe, it, expect, beforeEach } from 'vitest';
import { store } from './index';

describe('Global Store', () => {
  beforeEach(() => {
    store.xp = 0;
    store.currentPage = 'selection';
    store.activeUnitId = null;
    store.unitProgress = {};
  });

  it('should initialize with 0 XP', () => {
    expect(store.xp).toBe(0);
  });

  it('should track unit progress', () => {
    store.unitProgress['unit-01'] = {
      lessonComplete: false,
      activitiesComplete: {},
      storyRead: false,
    };
    expect(store.unitProgress['unit-01'].lessonComplete).toBe(false);
    store.unitProgress['unit-01'].lessonComplete = true;
    expect(store.unitProgress['unit-01'].lessonComplete).toBe(true);
  });

  it('should support page navigation', () => {
    expect(store.currentPage).toBe('selection');
    store.currentPage = 'campground';
    expect(store.currentPage).toBe('campground');
    store.activeUnitId = 'unit-01';
    store.currentPage = 'unit-hub';
    expect(store.currentPage).toBe('unit-hub');
  });
});
