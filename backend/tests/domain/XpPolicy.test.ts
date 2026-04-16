import { describe, expect, it } from 'bun:test';

import { deriveXp } from '../../src/domain/services/XpPolicy';

describe('XpPolicy', () => {
  it('derives XP from canonical UFLI progress only', () => {
    const xp = deriveXp({
      '001': {
        lessonComplete: true,
        activitiesComplete: {
          speech: true,
          match: true,
          blend: false,
          build: false,
          sentence: false
        },
        connectedTextRead: true
      },
      '002': {
        lessonComplete: false,
        activitiesComplete: {
          speech: true,
          match: false,
          blend: false,
          build: false,
          sentence: false
        },
        connectedTextRead: false
      }
    });

    expect(xp).toBe(325);
  });
});
