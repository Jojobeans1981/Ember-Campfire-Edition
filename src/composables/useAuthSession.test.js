import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const AUTH_STORAGE_KEY = 'ember-auth-session-v1';
const CALLBACK_STORAGE_KEY = 'ember-auth-callback-v1';

function setCognitoEnv() {
  vi.stubEnv('VITE_DEV_AUTH_TOKEN', '');
  vi.stubEnv('VITE_COGNITO_REGION', 'us-east-2');
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'pool-123');
  vi.stubEnv('VITE_COGNITO_USER_POOL_CLIENT_ID', 'client-123');
  vi.stubEnv('VITE_COGNITO_DOMAIN', 'ember-production-auth.auth.us-east-2.amazoncognito.com');
  vi.stubEnv('VITE_COGNITO_REDIRECT_URI', 'https://app.readwithember.com/auth/callback');
  vi.stubEnv('VITE_COGNITO_LOGOUT_URI', 'https://app.readwithember.com/');
}

function setDevAuthEnv() {
  vi.stubEnv('VITE_DEV_AUTH_TOKEN', 'dev:owner');
  vi.stubEnv('VITE_COGNITO_REGION', '');
  vi.stubEnv('VITE_COGNITO_USER_POOL_ID', '');
  vi.stubEnv('VITE_COGNITO_USER_POOL_CLIENT_ID', '');
  vi.stubEnv('VITE_COGNITO_DOMAIN', '');
  vi.stubEnv('VITE_COGNITO_REDIRECT_URI', '');
  vi.stubEnv('VITE_COGNITO_LOGOUT_URI', '');
}

function mockLocation({ href, pathname }) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href,
      pathname,
      assign: vi.fn(),
    },
  });
}

function createJsonResponse(status, body) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function encodeBase64Url(value) {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createUnsignedJwt(payload) {
  return `${encodeBase64Url({ alg: 'none', typ: 'JWT' })}.${encodeBase64Url(payload)}.signature`;
}

async function loadAuthSession() {
  const { useAuthSession } = await import('./useAuthSession.js');
  return useAuthSession();
}

function createDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('useAuthSession', () => {
  const originalLocation = window.location;
  const replaceState = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.doUnmock('../auth/pkce.js');
    localStorage.clear();
    sessionStorage.clear();
    replaceState.mockReset();

    setCognitoEnv();
    mockLocation({
      href: 'https://app.readwithember.com/auth/callback?error=access_denied&error_description=Login%20cancelled',
      pathname: '/auth/callback',
    });

    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  it('preserves hosted UI callback errors after clearing session state', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 60000,
    }));

    const authSession = await loadAuthSession();

    const handled = await authSession.handleCallback();

    expect(handled).toBe(true);
    expect(authSession.error).toBe('Login cancelled');
    expect(authSession.isAuthenticated()).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, document.title, '/');
  });

  it('returns false when not on auth callback route', async () => {
    mockLocation({
      href: 'https://app.readwithember.com/',
      pathname: '/',
    });

    const authSession = await loadAuthSession();
    const handled = await authSession.handleCallback();

    expect(handled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('rejects callback when stored state is missing', async () => {
    mockLocation({
      href: 'https://app.readwithember.com/auth/callback?code=abc&state=expected',
      pathname: '/auth/callback',
    });

    const authSession = await loadAuthSession();
    const handled = await authSession.handleCallback();

    expect(handled).toBe(true);
    expect(authSession.error).toBe('Sign-in session could not be verified.');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CALLBACK_STORAGE_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, document.title, '/');
  });

  it('rejects callback when returned state does not match stored state', async () => {
    mockLocation({
      href: 'https://app.readwithember.com/auth/callback?code=abc&state=wrong-state',
      pathname: '/auth/callback',
    });
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify({
      state: 'expected-state',
      codeVerifier: 'verifier-123',
      nonce: 'nonce-123',
    }));

    const authSession = await loadAuthSession();
    const handled = await authSession.handleCallback();

    expect(handled).toBe(true);
    expect(authSession.error).toBe('Sign-in session could not be verified.');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CALLBACK_STORAGE_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, document.title, '/');
  });

  it('rejects callback when id token nonce does not match stored nonce', async () => {
    mockLocation({
      href: 'https://app.readwithember.com/auth/callback?code=abc&state=state-123',
      pathname: '/auth/callback',
    });
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify({
      state: 'state-123',
      codeVerifier: 'verifier-123',
      nonce: 'expected-nonce',
    }));
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(200, {
      access_token: 'access-1',
      id_token: createUnsignedJwt({ nonce: 'wrong-nonce' }),
      refresh_token: 'refresh-1',
      expires_in: 3600,
    })));

    const authSession = await loadAuthSession();
    const handled = await authSession.handleCallback();

    expect(handled).toBe(true);
    expect(authSession.error).toBe('Cognito id_token nonce mismatch.');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CALLBACK_STORAGE_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, document.title, '/');
  });

  it('stores session on successful callback exchange', async () => {
    const idToken = createUnsignedJwt({ nonce: 'nonce-123' });

    mockLocation({
      href: 'https://app.readwithember.com/auth/callback?code=abc&state=state-123',
      pathname: '/auth/callback',
    });
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify({
      state: 'state-123',
      codeVerifier: 'verifier-123',
      nonce: 'nonce-123',
    }));
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(200, {
      access_token: 'access-1',
      id_token: idToken,
      refresh_token: 'refresh-1',
      expires_in: 3600,
      token_type: 'Bearer',
    })));

    const authSession = await loadAuthSession();
    const handled = await authSession.handleCallback();
    const persisted = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));

    expect(handled).toBe(true);
    expect(authSession.isAuthenticated()).toBe(true);
    expect(authSession.error).toBeNull();
    expect(persisted).toMatchObject({
      idToken,
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
    });
    expect(typeof persisted.expiresAt).toBe('number');
    expect(sessionStorage.getItem(CALLBACK_STORAGE_KEY)).toBeNull();
    expect(replaceState).toHaveBeenCalledWith({}, document.title, '/');
  });

  it('restores an unexpired stored cognito session without refreshing', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + (5 * 60 * 1000),
    }));

    const authSession = await loadAuthSession();
    const restored = await authSession.restoreSession();

    expect(restored).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    await expect(authSession.getBearerToken()).resolves.toBe('id-1');
  });

  it('refreshes an expired stored session during restore', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() - 1000,
    }));
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(200, {
      access_token: 'access-2',
      id_token: 'id-2',
      expires_in: 3600,
    })));

    const authSession = await loadAuthSession();
    const restored = await authSession.restoreSession();
    const persisted = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));

    expect(restored).toBe(true);
    expect(persisted).toMatchObject({
      accessToken: 'access-2',
      idToken: 'id-2',
      refreshToken: 'refresh-1',
    });
    await expect(authSession.getBearerToken()).resolves.toBe('id-2');
  });

  it('clears session when refresh fails during restore', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() - 1000,
    }));
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(401, {
      error: { message: 'Unauthorized' },
    })));

    const authSession = await loadAuthSession();
    const restored = await authSession.restoreSession();

    expect(restored).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(authSession.isAuthenticated()).toBe(false);
  });

  it('invalidates expired cognito sessions that are missing a refresh token', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      expiresAt: Date.now() - 1000,
    }));

    const authSession = await loadAuthSession();
    const restored = await authSession.restoreSession();

    expect(restored).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(authSession.isAuthenticated()).toBe(false);
    await expect(authSession.getBearerToken()).resolves.toBe('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shares one refresh request across parallel getBearerToken calls', async () => {
    const deferred = createDeferred();
    const fetchMock = vi.fn(() => deferred.promise);

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() - 1000,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const authSession = await loadAuthSession();
    const tokenPromise = Promise.all([
      authSession.getBearerToken(),
      authSession.getBearerToken(),
    ]);

    deferred.resolve(createJsonResponse(200, {
      access_token: 'access-2',
      id_token: 'id-2',
      expires_in: 3600,
    }));

    await expect(tokenPromise).resolves.toEqual(['id-2', 'id-2']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toMatchObject({
      idToken: 'id-2',
      accessToken: 'access-2',
      refreshToken: 'refresh-1',
    });
  });

  it('clears session when single-flight refresh fails', async () => {
    const deferred = createDeferred();
    const fetchMock = vi.fn(() => deferred.promise);

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() - 1000,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const authSession = await loadAuthSession();
    const tokenPromise = Promise.allSettled([
      authSession.getBearerToken(),
      authSession.getBearerToken(),
    ]);

    deferred.resolve(createJsonResponse(401, {
      error: { message: 'Unauthorized' },
    }));

    const results = await tokenPromise;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(results).toEqual([
      expect.objectContaining({ status: 'rejected' }),
      expect.objectContaining({ status: 'rejected' }),
    ]);
  });

  it('returns false and clears session when unauthorized handling runs without a cognito refresh token', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      expiresAt: Date.now() + 60000,
    }));

    const authSession = await loadAuthSession();
    const handled = await authSession.handleUnauthorizedResponse();

    expect(handled).toBe(false);
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(authSession.isAuthenticated()).toBe(false);
  });

  it('refreshes session when unauthorized handling runs with a cognito refresh token', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 60000,
    }));
    vi.stubGlobal('fetch', vi.fn(() => createJsonResponse(200, {
      access_token: 'access-2',
      id_token: 'id-2',
      expires_in: 3600,
    })));

    const authSession = await loadAuthSession();
    const handled = await authSession.handleUnauthorizedResponse();

    expect(handled).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toMatchObject({
      idToken: 'id-2',
      accessToken: 'access-2',
      refreshToken: 'refresh-1',
    });
    await expect(authSession.getBearerToken()).resolves.toBe('id-2');
  });

  it('uses dev auth token mode without cognito restore logic', async () => {
    setDevAuthEnv();

    const authSession = await loadAuthSession();

    await expect(authSession.restoreSession()).resolves.toBe(true);
    await expect(authSession.getBearerToken()).resolves.toBe('dev:owner');
    expect(authSession.mode).toBe('dev');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('startLogin stores callback state and redirects to authorize url', async () => {
    vi.doMock('../auth/pkce.js', () => ({
      generateCodeVerifier: vi.fn(() => 'verifier-123'),
      generateState: vi.fn(() => 'state-123'),
      generateNonce: vi.fn(() => 'nonce-123'),
      generateCodeChallenge: vi.fn(async () => 'challenge-123'),
    }));

    const authSession = await loadAuthSession();
    await authSession.startLogin();

    expect(JSON.parse(sessionStorage.getItem(CALLBACK_STORAGE_KEY))).toEqual({
      codeVerifier: 'verifier-123',
      state: 'state-123',
      nonce: 'nonce-123',
    });
    expect(window.location.assign).toHaveBeenCalledTimes(1);

    const assignedUrl = window.location.assign.mock.calls[0][0];

    expect(assignedUrl).toContain('/oauth2/authorize');
    expect(assignedUrl).toContain('response_type=code');
    expect(assignedUrl).toContain('client_id=client-123');
    expect(assignedUrl).toContain('redirect_uri=https%3A%2F%2Fapp.readwithember.com%2Fauth%2Fcallback');
    expect(assignedUrl).toContain('scope=openid+email+profile');
    expect(assignedUrl).toContain('code_challenge_method=S256');
    expect(assignedUrl).toContain('code_challenge=challenge-123');
    expect(assignedUrl).toContain('state=state-123');
    expect(assignedUrl).toContain('nonce=nonce-123');
  });

  it('logout clears session and redirects to cognito logout in cognito mode', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
      idToken: 'id-1',
      refreshToken: 'refresh-1',
      expiresAt: Date.now() + 60000,
    }));
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, JSON.stringify({
      codeVerifier: 'verifier-123',
      state: 'state-123',
      nonce: 'nonce-123',
    }));

    const authSession = await loadAuthSession();
    authSession.logout();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(CALLBACK_STORAGE_KEY)).toBeNull();
    expect(window.location.assign).toHaveBeenCalledTimes(1);

    const assignedUrl = window.location.assign.mock.calls[0][0];

    expect(assignedUrl).toContain('/logout');
    expect(assignedUrl).toContain('client_id=client-123');
    expect(assignedUrl).toContain('logout_uri=https%3A%2F%2Fapp.readwithember.com%2F');
  });
});
