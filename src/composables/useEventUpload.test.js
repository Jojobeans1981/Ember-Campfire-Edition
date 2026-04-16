import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearBootstrapState, replaceSkillState, skillState, store } from '../store';
import { clearEventUploadQueue, clearQueue, getPendingEventUploads, pushEvent } from '../store/events';
import { useEventUpload } from './useEventUpload.js';

function createJsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('useEventUpload', () => {
  beforeEach(() => {
    clearBootstrapState();
    clearQueue();
    clearEventUploadQueue();
    store.activeProfileId = 'profile-1';
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => 'event-1'),
    });
  });

  it('uploads queued response events without mutating canonical progress', async () => {
    store.version = 4;
    store.xp = 250;
    store.selectedFriend = { id: 'fox', name: 'Fox', file: 'fox.png' };
    store.ufliProgress['001'] = {
      lessonComplete: true,
      activitiesComplete: { speech: true },
      connectedTextRead: false,
    };
    replaceSkillState({ decoding: { streak: 6 } }, 3);

    pushEvent({
      id: crypto.randomUUID(),
      timestamp: '2026-04-15T12:00:00.000Z',
      sessionId: 'session-001',
      lessonRunId: null,
      activityRunId: 'workshop',
      stepId: null,
      itemId: 'match-m',
      conceptSlugs: ['m'],
      modality: 'tap_select',
      response: { selected: 'm' },
      correct: true,
      confidence: 1,
      supportLevel: 'guided',
      responseLatencyMs: null,
      attemptNumber: 1,
      wasRetryAfterPrompt: false,
    });

    const fetchMock = vi.fn((input, options = {}) => {
      const url = String(input);

      if (url.endsWith('/profiles/profile-1/events') && options.method === 'POST') {
        return createJsonResponse(200, {
          profileId: 'profile-1',
          appended: [{ clientEventId: 'event-1' }],
          duplicate: [],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { flushPendingEvents } = useEventUpload();
    await flushPendingEvents();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/profiles/profile-1/events');
    expect(getPendingEventUploads('profile-1')).toEqual([]);
    expect(store.version).toBe(4);
    expect(store.xp).toBe(250);
    expect(store.selectedFriend).toEqual({ id: 'fox', name: 'Fox', file: 'fox.png' });
    expect(store.ufliProgress['001']).toEqual({
      lessonComplete: true,
      activitiesComplete: { speech: true },
      connectedTextRead: false,
    });
    expect(skillState.decoding).toEqual({ streak: 6 });
    expect(store.skillStateSchemaVersion).toBe(3);
  });
});
