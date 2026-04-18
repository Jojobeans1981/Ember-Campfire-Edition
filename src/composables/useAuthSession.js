import { reactive } from 'vue';

import { buildAuthorizeUrl, buildLogoutUrl, buildTokenUrl } from '../auth/cognitoUrls.js';
import { generateCodeChallenge, generateCodeVerifier, generateNonce, generateState } from '../auth/pkce.js';
import { usePersistence } from './usePersistence.js';

const AUTH_STORAGE_KEY = 'ember-auth-session-v1';
const CALLBACK_STORAGE_KEY = 'ember-auth-callback-v1';
const REFRESH_SKEW_MS = 60 * 1000;
const initialMode = detectAuthMode();
const persistence = usePersistence();

const state = reactive({
  mode: initialMode,
  session: loadStoredSession(initialMode),
  error: null,
});

let inFlightRefreshPromise = null;

function detectAuthMode() {
  if (import.meta.env.VITE_DEV_AUTH_TOKEN) {
    return 'dev';
  }

  if (
    import.meta.env.VITE_COGNITO_REGION
    && import.meta.env.VITE_COGNITO_USER_POOL_ID
    && import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID
    && import.meta.env.VITE_COGNITO_DOMAIN
    && import.meta.env.VITE_COGNITO_REDIRECT_URI
    && import.meta.env.VITE_COGNITO_LOGOUT_URI
  ) {
    return 'cognito';
  }

  return 'unauthenticated';
}

function loadStoredSession(mode) {
  if (mode === 'dev' || mode === 'unauthenticated' || !persistence.hasStorageMethod('getItem')) {
    return null;
  }

  try {
    const raw = persistence.getStorageItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function persistSession(session) {
  state.session = session;

  try {
    if (session) {
      persistence.setStorageItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      persistence.removeStorageItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // Ignore blocked storage. The active in-memory session still works.
  }
}

function clearStoredSession() {
  persistSession(null);
}

function loadCallbackState() {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(CALLBACK_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function persistCallbackState(value) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify(value));
  }
}

function clearCallbackState() {
  try {
    sessionStorage.removeItem(CALLBACK_STORAGE_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

function isTokenExpired(session) {
  return !session?.expiresAt || (Date.now() + REFRESH_SKEW_MS) >= Number(session.expiresAt);
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function exchangeToken(params) {
  const response = await fetch(buildTokenUrl(import.meta.env.VITE_COGNITO_DOMAIN), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    throw new Error('Cognito token exchange failed.');
  }

  return response.json();
}

async function refreshSession() {
  if (state.mode !== 'cognito' || !state.session) {
    return null;
  }

  if (!state.session.refreshToken) {
    if (state.session.idToken) {
      clearSession();
      return false;
    }

    return null;
  }

  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = exchangeToken({
    grant_type: 'refresh_token',
    client_id: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    refresh_token: state.session.refreshToken,
  })
    .then((payload) => {
      const nextSession = normalizeTokenSession(payload, state.session.refreshToken);
      persistSession(nextSession);
      return nextSession;
    })
    .catch((error) => {
      clearSession();
      throw error;
    })
    .finally(() => {
      inFlightRefreshPromise = null;
    });

  return inFlightRefreshPromise;
}

function normalizeTokenSession(payload, fallbackRefreshToken = null) {
  const expiresInSeconds = Number(payload.expires_in ?? 0);

  return {
    accessToken: payload.access_token ?? null,
    idToken: payload.id_token ?? null,
    refreshToken: payload.refresh_token ?? fallbackRefreshToken,
    expiresAt: Date.now() + (expiresInSeconds * 1000),
    tokenType: payload.token_type ?? 'Bearer',
  };
}

async function handleCallback() {
  if (state.mode !== 'cognito' || window.location.pathname !== '/auth/callback') {
    return false;
  }

  const url = new URL(window.location.href);
  const error = url.searchParams.get('error');
  if (error) {
    state.error = url.searchParams.get('error_description') || error;
    clearCallbackState();
    clearStoredSession();
    window.history.replaceState({}, document.title, '/');
    return true;
  }

  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const callbackState = loadCallbackState();

  if (!code || !returnedState || !callbackState || callbackState.state !== returnedState) {
    state.error = 'Sign-in session could not be verified.';
    clearCallbackState();
    clearStoredSession();
    window.history.replaceState({}, document.title, '/');
    return true;
  }

  try {
    const payload = await exchangeToken({
      grant_type: 'authorization_code',
      client_id: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      code,
      code_verifier: callbackState.codeVerifier,
      redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
    });

    const decodedIdToken = decodeJwtPayload(payload.id_token);
    if (!decodedIdToken || decodedIdToken.nonce !== callbackState.nonce) {
      throw new Error('Cognito id_token nonce mismatch.');
    }

    persistSession(normalizeTokenSession(payload));
    state.error = null;
  } catch (error) {
    clearStoredSession();
    state.error = error instanceof Error ? error.message : 'Sign-in failed.';
  } finally {
    clearCallbackState();
    window.history.replaceState({}, document.title, '/');
  }

  return true;
}

async function restoreSession() {
  if (state.mode === 'dev') {
    return Boolean(import.meta.env.VITE_DEV_AUTH_TOKEN);
  }

  if (state.mode !== 'cognito' || !state.session) {
    return false;
  }

  if (!isTokenExpired(state.session)) {
    return true;
  }

  try {
    await refreshSession();
    return Boolean(state.session?.idToken);
  } catch {
    return false;
  }
}

async function initializeSession() {
  const handledCallback = await handleCallback();
  if (handledCallback) {
    return isAuthenticated();
  }

  return restoreSession();
}

async function getBearerToken() {
  if (state.mode === 'dev') {
    return import.meta.env.VITE_DEV_AUTH_TOKEN || '';
  }

  if (state.mode !== 'cognito') {
    return '';
  }

  if (!state.session) {
    return '';
  }

  if (isTokenExpired(state.session)) {
    await refreshSession();
  }

  // Backend Cognito mode validates the id_token for the first release.
  return state.session?.idToken || '';
}

function isAuthenticated() {
  if (state.mode === 'dev') {
    return Boolean(import.meta.env.VITE_DEV_AUTH_TOKEN);
  }

  if (state.mode !== 'cognito') {
    return false;
  }

  return Boolean(state.session?.idToken);
}

async function startLogin() {
  if (state.mode !== 'cognito') {
    return;
  }

  const codeVerifier = generateCodeVerifier();
  const stateToken = generateState();
  const nonce = generateNonce();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  persistCallbackState({
    codeVerifier,
    state: stateToken,
    nonce,
  });

  window.location.assign(buildAuthorizeUrl({
    domain: import.meta.env.VITE_COGNITO_DOMAIN,
    clientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
    redirectUri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
    codeChallenge,
    state: stateToken,
    nonce,
  }));
}

function clearSession() {
  clearStoredSession();
  state.error = null;
}

async function handleUnauthorizedResponse() {
  if (state.mode !== 'cognito' || !state.session?.refreshToken) {
    clearSession();
    return false;
  }

  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}

function logout() {
  const shouldRedirect = state.mode === 'cognito';
  clearSession();
  clearCallbackState();

  if (shouldRedirect) {
    window.location.assign(buildLogoutUrl({
      domain: import.meta.env.VITE_COGNITO_DOMAIN,
      clientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      logoutUri: import.meta.env.VITE_COGNITO_LOGOUT_URI,
    }));
  }
}

export function useAuthSession() {
  return {
    state,
    get mode() {
      return state.mode;
    },
    get error() {
      return state.error;
    },
    clearSession,
    getBearerToken,
    handleCallback,
    handleUnauthorizedResponse,
    initializeSession,
    isAuthenticated,
    logout,
    refreshSession,
    restoreSession,
    startLogin,
  };
}
