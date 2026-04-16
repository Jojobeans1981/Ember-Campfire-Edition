import { useApiClient } from './useApiClient.js';
import { store } from '../store';
import { getPendingEventUploads, removeUploadedEvents } from '../store/events';

const flushPromisesByProfileId = new Map();

export function useEventUpload() {
  const api = useApiClient();

  async function flushPendingEvents(profileId = store.activeProfileId) {
    if (!profileId) {
      return null;
    }

    const pendingEvents = getPendingEventUploads(profileId);
    if (pendingEvents.length === 0) {
      return null;
    }

    const existingFlushPromise = flushPromisesByProfileId.get(profileId);
    if (existingFlushPromise) {
      return existingFlushPromise;
    }

    const flushPromise = api.appendEvents(profileId, pendingEvents.map((event) => ({
      clientEventId: event.clientEventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      schemaVersion: event.schemaVersion,
      payload: event.payload,
    })))
      .then((result) => {
        removeUploadedEvents(profileId, [
          ...result.appended.map((event) => event.clientEventId),
          ...result.duplicate.map((event) => event.clientEventId),
        ]);

        return result;
      })
      .finally(() => {
        flushPromisesByProfileId.delete(profileId);
      });

    flushPromisesByProfileId.set(profileId, flushPromise);

    return flushPromise;
  }

  return {
    flushPendingEvents,
  };
}
