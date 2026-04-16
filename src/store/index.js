import { reactive } from 'vue';

/** @type {Record<string, import('../models').SkillState>} */
export const skillState = reactive({});

export const DEFAULT_SKILL_STATE_SCHEMA_VERSION = 1;

function replaceReactiveRecord(target, next) {
  for (const key of Object.keys(target)) {
    delete target[key];
  }

  Object.assign(target, next ?? {});
}

export function createEmptyProfileSnapshot(profileId = null) {
  return {
    profileId,
    version: 0,
    ufliProgress: {},
    xp: 0,
    selectedFriend: null,
    skillState: {},
    skillStateSchemaVersion: DEFAULT_SKILL_STATE_SCHEMA_VERSION,
    updatedAt: null,
  };
}

export const store = reactive({
  currentPage: 'selection',
  activeLessonId: null,
  activeActivity: null,
  currentUser: null,
  account: null,
  profiles: [],
  activeProfileId: null,
  bootstrapStatus: 'idle',
  bootstrapError: null,
  selectedFriend: null,
  xp: 0,
  ufliProgress: {},
  version: 0,
  pendingOperations: [],
  syncStatus: 'idle',
  lastSyncError: null,
  lastRecoveryError: null,
  skillStateSchemaVersion: DEFAULT_SKILL_STATE_SCHEMA_VERSION,
  updatedAt: null,
});

export function setPendingOperations(operations) {
  store.pendingOperations.splice(0, store.pendingOperations.length, ...(operations ?? []));
}

export function resetSyncedProgressState() {
  store.selectedFriend = null;
  store.xp = 0;
  store.version = 0;
  setPendingOperations([]);
  store.syncStatus = 'idle';
  store.lastSyncError = null;
  store.lastRecoveryError = null;
  store.skillStateSchemaVersion = DEFAULT_SKILL_STATE_SCHEMA_VERSION;
  store.updatedAt = null;
  replaceReactiveRecord(store.ufliProgress, {});
  replaceReactiveRecord(skillState, {});
}

export function applyCanonicalSnapshot(snapshot) {
  const next = snapshot ?? createEmptyProfileSnapshot(store.activeProfileId);
  store.version = typeof next.version === 'number' ? next.version : 0;
  store.xp = typeof next.xp === 'number' ? next.xp : 0;
  store.selectedFriend = next.selectedFriend ?? null;
  store.skillStateSchemaVersion = typeof next.skillStateSchemaVersion === 'number'
    ? next.skillStateSchemaVersion
    : DEFAULT_SKILL_STATE_SCHEMA_VERSION;
  store.updatedAt = next.updatedAt ?? null;
  replaceReactiveRecord(store.ufliProgress, next.ufliProgress ?? {});
  replaceReactiveRecord(skillState, next.skillState ?? {});
}

export function replaceSkillState(nextSkillState, nextSchemaVersion = store.skillStateSchemaVersion) {
  replaceReactiveRecord(skillState, nextSkillState ?? {});
  store.skillStateSchemaVersion = nextSchemaVersion;
}

export function hydrateBootstrapState({ currentUser = null, account = null, profiles = [], activeProfileId = null } = {}) {
  store.currentUser = currentUser;
  store.account = account;
  store.profiles.splice(0, store.profiles.length, ...(profiles ?? []));
  store.activeProfileId = activeProfileId;
}

export function clearBootstrapState() {
  hydrateBootstrapState();
  store.bootstrapStatus = 'idle';
  store.bootstrapError = null;
  resetSyncedProgressState();
}
