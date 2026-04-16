import { useApiClient, ApiError } from './useApiClient.js';
import { usePersistence } from './usePersistence.js';
import {
  applyCanonicalSnapshot,
  createEmptyProfileSnapshot,
  replaceSkillState,
  resetSyncedProgressState,
  setPendingOperations,
  store,
} from '../store';

function createDefaultLessonProgress() {
  return {
    lessonComplete: false,
    activitiesComplete: {},
    connectedTextRead: false,
  };
}

function ensureLessonProgress(lessonId) {
  if (!store.ufliProgress[lessonId]) {
    store.ufliProgress[lessonId] = createDefaultLessonProgress();
  }

  return store.ufliProgress[lessonId];
}

function createClientOperationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `client-op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSyncError(error) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Progress sync failed.';
}

function formatRecoveryConflict(error) {
  if (error instanceof ApiError && error.status === 409) {
    return 'A newer server snapshot already exists, so the local repair copy was skipped.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Recovery failed.';
}

const flushPromisesByProfileId = new Map();
const RECOVERY_REASON_STALE_CACHE = 'bootstrap_stale_cache';

function ensureRecoveryFlow(options) {
  if (options?.repair === true && typeof options.reason === 'string' && options.reason.length > 0) {
    return;
  }

  throw new Error('Progress snapshot recovery is reserved for explicit repair flows.');
}

export function useProfileProgress() {
  const api = useApiClient();
  const persistence = usePersistence();

  function applyOptimisticOperation(operation) {
    switch (operation.type) {
      case 'complete_lesson': {
        const progress = ensureLessonProgress(operation.payload.lessonId);
        progress.lessonComplete = true;
        return;
      }

      case 'complete_activity': {
        const progress = ensureLessonProgress(operation.payload.lessonId);
        progress.activitiesComplete[operation.payload.activityType] = true;
        return;
      }

      case 'complete_connected_text': {
        const progress = ensureLessonProgress(operation.payload.lessonId);
        progress.connectedTextRead = true;
        return;
      }

      case 'set_selected_friend':
        store.selectedFriend = operation.payload.selectedFriend;
        return;

      case 'replace_skill_state':
        replaceSkillState(operation.payload.skillState, operation.payload.skillStateSchemaVersion);
    }
  }

  function applyOptimisticOperations(operations) {
    for (const operation of operations) {
      applyOptimisticOperation(operation);
    }
  }

  function queueOperation(type, payload) {
    if (!store.activeProfileId) {
      throw new Error('Cannot queue progress operations without an active profile.');
    }

    const operation = {
      clientOperationId: createClientOperationId(),
      type,
      payload,
      createdAt: new Date().toISOString(),
    };

    applyOptimisticOperation(operation);
    store.pendingOperations.push(operation);
    store.syncStatus = 'pending';
    store.lastSyncError = null;
    store.lastRecoveryError = null;
    persistence.saveProfileState();
    return operation;
  }

  async function recoverProfileProgress(profileId, snapshot, options = {}) {
    ensureRecoveryFlow(options);
    store.lastRecoveryError = null;

    try {
      const recoveredSnapshot = await api.submitProgressSnapshot(profileId, {
        version: snapshot.version,
        ufliProgress: snapshot.ufliProgress,
        selectedFriend: snapshot.selectedFriend,
        skillState: snapshot.skillState,
        skillStateSchemaVersion: snapshot.skillStateSchemaVersion,
      });

      if (store.activeProfileId === profileId) {
        applyCanonicalSnapshot(recoveredSnapshot);
        persistence.saveProfileState(profileId, {
          snapshot: recoveredSnapshot,
          pendingOperations: [],
        });
      }

      return recoveredSnapshot;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && store.activeProfileId === profileId) {
        store.lastRecoveryError = formatRecoveryConflict(error);
      }

      throw error;
    }
  }

  async function flushPendingOperations() {
    const profileId = store.activeProfileId;

    if (!profileId || store.pendingOperations.length === 0) {
      store.syncStatus = 'idle';
      persistence.saveProfileState();
      return null;
    }

    const existingFlushPromise = flushPromisesByProfileId.get(profileId);
    if (existingFlushPromise) {
      return existingFlushPromise;
    }

    const queuedOperations = [...store.pendingOperations];
    const startingVersion = store.version;

    store.syncStatus = 'syncing';
    store.lastSyncError = null;

    let shouldFollowUpFlush = false;

    const flushPromise = api.submitProgressOperations(profileId, startingVersion, queuedOperations)
      .then(async (result) => {
        const completedIds = new Set([
          ...result.applied.map((entry) => entry.clientOperationId),
          ...result.rejected.map((entry) => entry.clientOperationId),
        ]);

        const activeProfileUnchanged = store.activeProfileId === profileId;

        if (!activeProfileUnchanged) {
          const cachedState = persistence.loadProfileState(profileId);
          const cachedPendingOperations = cachedState?.pendingOperations ?? queuedOperations;
          const remainingOperations = cachedPendingOperations.filter(
            (operation) => !completedIds.has(operation.clientOperationId)
          );

          persistence.saveProfileState(profileId, {
            snapshot: result.snapshot,
            pendingOperations: remainingOperations,
          });

          return result;
        }

        applyCanonicalSnapshot(result.snapshot);
        setPendingOperations(store.pendingOperations.filter((operation) => !completedIds.has(operation.clientOperationId)));
        applyOptimisticOperations(store.pendingOperations);

        if (result.rejected.length > 0) {
          store.syncStatus = store.pendingOperations.length > 0 ? 'pending' : 'error';
          store.lastSyncError = result.rejected.map((entry) => entry.message).join(' ');
        } else {
          store.syncStatus = store.pendingOperations.length > 0 ? 'pending' : 'idle';
          store.lastSyncError = null;
        }

        persistence.saveProfileState();

        if (store.pendingOperations.length > 0) {
          shouldFollowUpFlush = true;
        }

        return result;
      })
      .catch((error) => {
        if (store.activeProfileId === profileId) {
          store.syncStatus = 'error';
          store.lastSyncError = formatSyncError(error);
          persistence.saveProfileState();
        }
        throw error;
      })
      .finally(() => {
        flushPromisesByProfileId.delete(profileId);
      })
      .then(async (result) => {
        if (shouldFollowUpFlush && store.activeProfileId === profileId) {
          await flushPendingOperations();
        }

        return result;
      });

    flushPromisesByProfileId.set(profileId, flushPromise);

    return flushPromise;
  }

  async function bootstrapProfileProgress(profileId) {
    store.activeProfileId = profileId;
    resetSyncedProgressState();

    const cached = persistence.loadProfileState(profileId);
    if (cached?.snapshot) {
      applyCanonicalSnapshot({
        ...createEmptyProfileSnapshot(profileId),
        ...cached.snapshot,
      });
      setPendingOperations(cached.pendingOperations ?? []);
      store.syncStatus = store.pendingOperations.length > 0 ? 'pending' : 'idle';
    }

    const snapshot = await api.getProfileProgress(profileId);
    let canonicalSnapshot = snapshot;
    const cachedPendingOperations = cached?.pendingOperations ?? [];

    if (cached?.snapshot?.version > snapshot.version && cachedPendingOperations.length === 0) {
      try {
        canonicalSnapshot = await recoverProfileProgress(profileId, cached.snapshot, {
          repair: true,
          reason: RECOVERY_REASON_STALE_CACHE,
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) {
          throw error;
        }
      }
    }

    applyCanonicalSnapshot(canonicalSnapshot);
    setPendingOperations(cachedPendingOperations);
    applyOptimisticOperations(store.pendingOperations);
    store.syncStatus = store.pendingOperations.length > 0 ? 'pending' : 'idle';
    store.lastSyncError = null;
    persistence.saveProfileState();

    if (store.pendingOperations.length > 0) {
      await flushPendingOperations();
    }
  }

  async function submitOperation(type, payload) {
    queueOperation(type, payload);
    return flushPendingOperations();
  }

    return {
      bootstrapProfileProgress,
      flushPendingOperations,
      recoverProfileProgress,
      RECOVERY_REASON_STALE_CACHE,
      submitOperation,
    };
}
