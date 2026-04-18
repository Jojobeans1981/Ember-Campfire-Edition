import { useApiClient, ApiError } from './useApiClient.js';
import { useAuthSession } from './useAuthSession.js';
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

function createDevIdentityKey(token) {
  const source = String(token ?? '').trim();
  if (!source) {
    return null;
  }

  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }

  return `token-${Math.abs(hash).toString(36)}`;
}

export function useAppBootstrap() {
  const api = useApiClient();
  const authSession = useAuthSession();
  const persistence = usePersistence();
  const profileProgress = useProfileProgress();

  async function resolveBootstrapScope() {
    if (authSession.mode === 'dev') {
      const token = await authSession.getBearerToken();
      return {
        devIdentityKey: createDevIdentityKey(token) ?? 'token-anonymous',
      };
    }

    return {
      accountId: store.currentUser?.accountId ?? null,
    };
  }

  async function selectProfile(profileId) {
    store.activeProfileId = profileId;
    const scope = await resolveBootstrapScope();
    persistence.saveBootstrapState(scope);
    await profileProgress.bootstrapProfileProgress(profileId);
    persistence.saveBootstrapState(scope);
  }

  async function bootstrapApp() {
    store.bootstrapStatus = 'loading';
    store.bootstrapError = null;

    if (!authSession.isAuthenticated()) {
      clearBootstrapState();
      store.bootstrapStatus = 'unauthenticated';
      return { unauthenticated: true };
    }

    const devScope = authSession.mode === 'dev' ? await resolveBootstrapScope() : null;
    const bootstrapScopeKey = authSession.mode === 'dev'
      ? persistence.createScopeKey(devScope)
      : (store.currentUser?.accountId
        ? persistence.createScopeKey({ accountId: store.currentUser.accountId })
        : persistence.getLastBootstrapScopeKey());
    const persisted = authSession.mode === 'dev' ? persistence.loadBootstrapState(devScope) : null;
    if (persisted?.bootstrapCache) {
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

      const persistenceScope = authSession.mode === 'dev'
        ? devScope
        : { accountId: currentUser.accountId };

      const scopedPersisted = persistence.loadBootstrapState(persistenceScope);

      const nextActiveProfileId = resolveActiveProfileId(scopedPersisted.activeProfileId, profiles);

      hydrateBootstrapState({ currentUser, account, profiles, activeProfileId: nextActiveProfileId });
      persistence.saveBootstrapState(persistenceScope);

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
        if (bootstrapScopeKey) {
          persistence.clearBootstrapScope(bootstrapScopeKey);
        }
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
    persistence.saveBootstrapState(await resolveBootstrapScope());
    await bootstrapApp();
    return profile;
  }

  return {
    bootstrapApp,
    createProfile,
    selectProfile,
  };
}
