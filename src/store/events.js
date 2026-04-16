import { store } from '../store';

const EVENT_SCHEMA_VERSION = 1;

/** @type {import('../models').ResponseEvent[]} */
export const eventQueue = [];

// Uploaded events are append-only telemetry. Canonical profile progress and
// skillState stay owned by progress snapshots plus queued progress operations.
/** @type {import('../models').QueuedEventEnvelope[]} */
export const eventUploadQueue = [];

function createEventEnvelope(event, profileId = store.activeProfileId) {
  if (!profileId) {
    return null;
  }

  return {
    profileId,
    clientEventId: event.id,
    eventType: 'response.recorded',
    occurredAt: event.timestamp,
    schemaVersion: EVENT_SCHEMA_VERSION,
    payload: {
      sessionId: event.sessionId,
      lessonRunId: event.lessonRunId,
      activityRunId: event.activityRunId,
      stepId: event.stepId,
      itemId: event.itemId,
      conceptSlugs: [...event.conceptSlugs],
      modality: event.modality,
      response: event.response,
      correct: event.correct,
      confidence: event.confidence,
      supportLevel: event.supportLevel,
      responseLatencyMs: event.responseLatencyMs,
      attemptNumber: event.attemptNumber,
      wasRetryAfterPrompt: event.wasRetryAfterPrompt,
    },
  };
}

export function pushEvent(event) {
  eventQueue.push(event);

  const envelope = createEventEnvelope(event);
  if (envelope) {
    eventUploadQueue.push(envelope);
  }
}

export function clearQueue() {
  eventQueue.length = 0;
}

export function getPendingEventUploads(profileId = store.activeProfileId) {
  return eventUploadQueue.filter((event) => event.profileId === profileId);
}

export function removeUploadedEvents(profileId, clientEventIds) {
  if (!profileId || !Array.isArray(clientEventIds) || clientEventIds.length === 0) {
    return;
  }

  const uploadedIds = new Set(clientEventIds);

  for (let index = eventUploadQueue.length - 1; index >= 0; index -= 1) {
    const event = eventUploadQueue[index];
    if (event.profileId === profileId && uploadedIds.has(event.clientEventId)) {
      eventUploadQueue.splice(index, 1);
    }
  }
}

export function clearEventUploadQueue() {
  eventUploadQueue.length = 0;
}
