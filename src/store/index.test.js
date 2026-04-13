import { describe, it, expect, beforeEach } from 'vitest';
import { store } from './index';

describe('Global Store', () => {
  beforeEach(() => {
    store.xp = 0;
    store.currentPage = 'selection';
    store.activeBuilding = 'Campfire';
  });

  it('should initialize with 0 XP', () => {
    expect(store.xp).toBe(0);
  });

  it('should unlock the library at 200 XP', () => {
    expect(store.libraryUnlocked).toBe(false);
    store.xp = 200;
    expect(store.libraryUnlocked).toBe(true);
  });

  it('should not unlock the library below 200 XP', () => {
    store.xp = 199;
    expect(store.libraryUnlocked).toBe(false);
  });
});
