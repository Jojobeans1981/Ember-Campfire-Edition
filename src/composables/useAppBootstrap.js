import { useApiClient, ApiError } from './useApiClient.js';
import { usePersistence } from './usePersistence.js';
import { useProfileProgress } from './useProfileProgress.js';
import {
  clearBootstrapState,
  hydrateBootstrapState,
  resetSyncedProgressState,
  store,
} from '../store';

function resolveActiveProfileId(persistedActiveProfileId, profiles) {
  if (profiles.length === 0) {
    return null;
  }

  if (profiles.length === 1) {
    return profiles[0].id;
  }

  return profiles.some((profile) => profile.id === persistedActiveProfileId)
    ? persistedActiveProfileId
    : null;
}

export function useAppBootstrap() {
  const api = useApiClient();
  const persistence = usePersistence();
  const profileProgress = useProfileProgress();

  async function selectProfile(profileId) {
    store.activeProfileId = profileId;
    persistence.saveBootstrapState();
    await profileProgress.bootstrapProfileProgress(profileId);
    persistence.saveBootstrapState();
  }

  async function bootstrapApp() {
    store.bootstrapStatus = 'loading';
    store.bootstrapError = null;

    const persisted = persistence.loadBootstrapState();
    if (persisted.bootstrapCache) {
      hydrateBootstrapState({
        currentUser: persisted.bootstrapCache.currentUser,
        account: persisted.bootstrapCache.account,
        profiles: persisted.bootstrapCache.profiles,
        activeProfileId: persisted.activeProfileId,
      });
    }

    try {
      const [currentUser, account, profiles] = await Promise.all([
        api.getMe(),
        api.getAccount(),
        api.getProfiles(),
      ]);

      const nextActiveProfileId = resolveActiveProfileId(persisted.activeProfileId, profiles);

      hydrateBootstrapState({ currentUser, account, profiles, activeProfileId: nextActiveProfileId });
      persistence.saveBootstrapState();

      if (nextActiveProfileId) {
        await profileProgress.bootstrapProfileProgress(nextActiveProfileId);
      } else {
        resetSyncedProgressState();
        store.activeProfileId = null;
      }

      store.bootstrapStatus = 'ready';
      return {
        unauthenticated: false,
        requiresProfileSelection: profiles.length > 1 && !nextActiveProfileId,
        requiresProfileCreation: profiles.length === 0,
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearBootstrapState();
        persistence.clearBootstrapState();
        store.bootstrapStatus = 'unauthenticated';
        return { unauthenticated: true };
      }

      store.bootstrapStatus = 'error';
      store.bootstrapError = error instanceof Error ? error.message : 'App bootstrap failed.';
      throw error;
    }
  }

  async function createProfile(name) {
    const profile = await api.createProfile(name);
    store.profiles.splice(0, store.profiles.length, profile);
    persistence.saveBootstrapState();
    await bootstrapApp();
    return profile;
  }

  return {
    bootstrapApp,
    createProfile,
    selectProfile,
  };
}
