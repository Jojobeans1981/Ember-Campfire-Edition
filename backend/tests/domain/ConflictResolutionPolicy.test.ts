import { describe, expect, it } from 'bun:test';

import { applyProgressOperations } from '../../src/domain/services/ConflictResolutionPolicy';
import type { ProfileProgress, ProgressOperation } from '../../src/domain/models';

const baseSnapshot: ProfileProgress = {
  profileId: 'profile-1',
  version: 3,
  ufliProgress: {
    '001': {
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
  },
  xp: 50,
  selectedFriend: {
    id: 'ember',
    name: 'Ember',
    file: 'ember.png'
  },
  skillState: {
    decoding: { streak: 2 }
  },
  skillStateSchemaVersion: 1,
  updatedAt: new Date('2026-04-15T10:00:00.000Z')
};

describe('ConflictResolutionPolicy', () => {
  it('rejects activity completion before the lesson is complete', () => {
    const operations: ProgressOperation[] = [
      {
        profileId: 'profile-1',
        clientOperationId: 'op-1',
        baseVersion: 3,
        type: 'complete_activity',
        payload: {
          lessonId: '001',
          activityType: 'match'
        },
        createdAt: new Date('2026-04-15T10:05:00.000Z')
      }
    ];

    const result = applyProgressOperations(
      baseSnapshot,
      operations,
      new Date('2026-04-15T10:06:00.000Z')
    );

    expect(result.startingVersion).toBe(3);
    expect(result.endingVersion).toBe(3);
    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([
      {
        clientOperationId: 'op-1',
        code: 'invalid',
        message: 'Activity completion requires the lesson to be complete.'
      }
    ]);
    expect(result.snapshot.ufliProgress['001']).toEqual(baseSnapshot.ufliProgress['001']);
    expect(result.snapshot.xp).toBe(50);
    expect(result.snapshot.updatedAt).toEqual(baseSnapshot.updatedAt);
  });

  it('rejects connected text completion before all activities are complete', () => {
    const snapshot: ProfileProgress = {
      ...baseSnapshot,
      ufliProgress: {
        ...baseSnapshot.ufliProgress,
        '001': {
          ...baseSnapshot.ufliProgress['001'],
          lessonComplete: true
        }
      },
      xp: 150
    };

    const operations: ProgressOperation[] = [
      {
        profileId: 'profile-1',
        clientOperationId: 'op-2',
        baseVersion: 3,
        type: 'complete_connected_text',
        payload: {
          lessonId: '001'
        },
        createdAt: new Date('2026-04-15T10:05:01.000Z')
      }
    ];

    const result = applyProgressOperations(
      snapshot,
      operations,
      new Date('2026-04-15T10:06:00.000Z')
    );

    expect(result.startingVersion).toBe(3);
    expect(result.endingVersion).toBe(3);
    expect(result.applied).toEqual([]);
    expect(result.rejected).toEqual([
      {
        clientOperationId: 'op-2',
        code: 'invalid',
        message: 'Connected text completion requires all lesson activities to be complete.'
      }
    ]);
    expect(result.snapshot.ufliProgress['001']).toEqual(snapshot.ufliProgress['001']);
    expect(result.snapshot.xp).toBe(150);
  });

  it('partially applies a stale mixed batch and rejects stale skill state replacement', () => {
    const operations: ProgressOperation[] = [
      {
        profileId: 'profile-1',
        clientOperationId: 'op-3',
        baseVersion: 2,
        type: 'complete_lesson',
        payload: {
          lessonId: '001'
        },
        createdAt: new Date('2026-04-15T10:07:00.000Z')
      },
      {
        profileId: 'profile-1',
        clientOperationId: 'op-4',
        baseVersion: 2,
        type: 'replace_skill_state',
        payload: {
          skillState: {
            decoding: { streak: 99 }
          },
          skillStateSchemaVersion: 2
        },
        createdAt: new Date('2026-04-15T10:07:01.000Z')
      },
      {
        profileId: 'profile-1',
        clientOperationId: 'op-5',
        baseVersion: 2,
        type: 'set_selected_friend',
        payload: {
          selectedFriend: {
            id: 'spark',
            name: 'Spark',
            file: 'spark.png'
          }
        },
        createdAt: new Date('2026-04-15T10:07:02.000Z')
      }
    ];

    const result = applyProgressOperations(
      baseSnapshot,
      operations,
      new Date('2026-04-15T10:08:00.000Z')
    );

    expect(result.startingVersion).toBe(3);
    expect(result.endingVersion).toBe(4);
    expect(result.applied).toEqual([
      { clientOperationId: 'op-3', appliedVersion: 4 },
      { clientOperationId: 'op-5', appliedVersion: 4 }
    ]);
    expect(result.rejected).toEqual([
      {
        clientOperationId: 'op-4',
        code: 'conflict',
        message: 'Operation is stale against newer server skill state.'
      }
    ]);
    expect(result.snapshot.ufliProgress['001'].lessonComplete).toBe(true);
    expect(result.snapshot.selectedFriend).toEqual({
      id: 'spark',
      name: 'Spark',
      file: 'spark.png'
    });
    expect(result.snapshot.skillState).toEqual({
      decoding: { streak: 2 }
    });
    expect(result.snapshot.skillStateSchemaVersion).toBe(1);
    expect(result.snapshot.xp).toBe(150);
  });

  it('replaces skill state when the batch is current and increments version once', () => {
    const operations: ProgressOperation[] = [
      {
        profileId: 'profile-1',
        clientOperationId: 'op-6',
        baseVersion: 3,
        type: 'complete_lesson',
        payload: {
          lessonId: '001'
        },
        createdAt: new Date('2026-04-15T10:08:00.000Z')
      },
      {
        profileId: 'profile-1',
        clientOperationId: 'op-7',
        baseVersion: 3,
        type: 'replace_skill_state',
        payload: {
          skillState: {
            decoding: { streak: 4 }
          },
          skillStateSchemaVersion: 2
        },
        createdAt: new Date('2026-04-15T10:08:01.000Z')
      }
    ];

    const result = applyProgressOperations(
      baseSnapshot,
      operations,
      new Date('2026-04-15T10:09:00.000Z')
    );

    expect(result.endingVersion).toBe(4);
    expect(result.rejected).toEqual([]);
    expect(result.applied).toEqual([
      { clientOperationId: 'op-6', appliedVersion: 4 },
      { clientOperationId: 'op-7', appliedVersion: 4 }
    ]);
    expect(result.snapshot.ufliProgress['001'].lessonComplete).toBe(true);
    expect(result.snapshot.skillState).toEqual({
      decoding: { streak: 4 }
    });
    expect(result.snapshot.skillStateSchemaVersion).toBe(2);
    expect(result.snapshot.xp).toBe(150);
  });
});
