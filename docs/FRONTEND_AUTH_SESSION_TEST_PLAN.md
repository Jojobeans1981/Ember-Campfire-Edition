# Frontend Auth Session Test Plan

This document is the concrete implementation plan for the remaining frontend auth-session coverage.

Scope:

- `src/composables/useAuthSession.test.js`
- `src/composables/useApiClient.test.js`

Goal:

- Prove callback parsing, session restore, refresh, single-flight refresh, direct unauthorized-response handling, bearer attachment, and `401` retry behavior without relying only on `App.vue` integration tests.

## Test Harness Rules

### `useAuthSession.js`

- `useAuthSession.js` has module-level state:
  - `state`
  - `inFlightRefreshPromise`
- Every test must start with:
  - `vi.resetModules()`
  - env stubs set before importing the module
  - fresh `window.location`
  - cleared `localStorage` and `sessionStorage`
  - fresh `fetch` stub
- Import `useAuthSession.js` dynamically inside each test or through a helper after setup.
- For `startLogin()` tests, mock PKCE helpers so callback-state values and authorize URL params are deterministic.

### `useApiClient.js`

- Mock `./useAuthSession.js` directly.
- Keep API-client tests focused on:
  - auth header behavior
  - `401` retry behavior
  - retry uses a freshly fetched bearer token
  - no infinite retry

## Shared Helpers

Add these helpers in `src/composables/useAuthSession.test.js`:

### `setCognitoEnv()`

Stubs:

- `VITE_DEV_AUTH_TOKEN = ''`
- `VITE_COGNITO_REGION = 'us-east-2'`
- `VITE_COGNITO_USER_POOL_ID = 'pool-123'`
- `VITE_COGNITO_USER_POOL_CLIENT_ID = 'client-123'`
- `VITE_COGNITO_DOMAIN = 'ember-production-auth.auth.us-east-2.amazoncognito.com'`
- `VITE_COGNITO_REDIRECT_URI = 'https://app.readwithember.com/auth/callback'`
- `VITE_COGNITO_LOGOUT_URI = 'https://app.readwithember.com/'`

### `setDevAuthEnv()`

Stubs:

- `VITE_DEV_AUTH_TOKEN = 'dev:owner'`
- clear or leave Cognito envs unset

### `mockLocation({ href, pathname })`

Replaces `window.location` with:

- `href`
- `pathname`
- `assign: vi.fn()`

### `createJsonResponse(status, body)`

Returns a fetch-like response with:

- `ok`
- `status`
- `json()`

### `createUnsignedJwt(payload)`

Returns `header.payload.signature` where:

- header is a base64url-encoded JWT header object
- payload is base64url-encoded input payload
- signature can be a dummy string

This is enough because frontend code only decodes the payload and does not verify signatures.

### `loadAuthSession()`

Does dynamic import after setup:

- `const { useAuthSession } = await import('./useAuthSession.js')`
- `return useAuthSession()`

### `createDeferred()`

Helper for single-flight tests:

- returns `{ promise, resolve, reject }`

## File 1: `src/composables/useAuthSession.test.js`

### Existing test to keep

1. `preserves hosted UI callback errors after clearing session state`

### Add these tests

1. `returns false when not on auth callback route`

Setup:

- Cognito env enabled
- `window.location.pathname = '/'`

Action:

- call `handleCallback()`

Assert:

- returns `false`
- `fetch` not called
- `replaceState` not called

2. `rejects callback when stored state is missing`

Setup:

- callback URL contains `?code=abc&state=expected`
- no callback state stored in `sessionStorage`

Action:

- call `handleCallback()`

Assert:

- returns `true`
- `error === 'Sign-in session could not be verified.'`
- auth storage cleared
- callback storage cleared
- `replaceState({}, document.title, '/')` called

3. `rejects callback when returned state does not match stored state`

Setup:

- callback URL contains `state=wrong-state`
- callback storage contains:
  - `state: 'expected-state'`
  - `codeVerifier: 'verifier-123'`
  - `nonce: 'nonce-123'`

Action:

- call `handleCallback()`

Assert:

- same assertions as missing-state case

4. `rejects callback when id token nonce does not match stored nonce`

Setup:

- callback URL contains valid `code` and matching `state`
- callback storage contains matching `state`, `codeVerifier`, `nonce: 'expected-nonce'`
- mock token exchange success response:
  - `access_token: 'access-1'`
  - `id_token: createUnsignedJwt({ nonce: 'wrong-nonce' })`
  - `refresh_token: 'refresh-1'`
  - `expires_in: 3600`

Action:

- call `handleCallback()`

Assert:

- returns `true`
- `error === 'Cognito id_token nonce mismatch.'`
- auth storage cleared
- callback storage cleared
- URL cleaned with `replaceState`

5. `stores session on successful callback exchange`

Setup:

- callback URL contains valid `code` and matching `state`
- callback storage contains:
  - `state: 'state-123'`
  - `codeVerifier: 'verifier-123'`
  - `nonce: 'nonce-123'`
- token exchange returns:
  - `access_token: 'access-1'`
  - `id_token: createUnsignedJwt({ nonce: 'nonce-123' })`
  - `refresh_token: 'refresh-1'`
  - `expires_in: 3600`
  - `token_type: 'Bearer'`

Action:

- call `handleCallback()`

Assert:

- returns `true`
- `isAuthenticated() === true`
- `error === null`
- `localStorage['ember-auth-session-v1']` contains:
  - `idToken` equal to the returned `id_token`
  - `accessToken` equal to `'access-1'`
  - `refreshToken` equal to `'refresh-1'`
  - numeric `expiresAt`
  - `tokenType` equal to `'Bearer'`
- callback storage removed
- URL cleaned with `replaceState`

6. `restores an unexpired stored cognito session without refreshing`

Setup:

- seed `localStorage['ember-auth-session-v1']` with:
  - `idToken: 'id-1'`
  - `refreshToken: 'refresh-1'`
  - `expiresAt: Date.now() + 5 * 60 * 1000`

Action:

- import auth session
- call `restoreSession()`

Assert:

- returns `true`
- `fetch` not called
- `getBearerToken()` returns `'id-1'`

7. `refreshes an expired stored session during restore`

Setup:

- seed expired stored session with refresh token
- mock refresh response:
  - `access_token: 'access-2'`
  - `id_token: 'id-2'`
  - no new `refresh_token`
  - `expires_in: 3600`

Action:

- call `restoreSession()`

Assert:

- returns `true`
- persisted session now has `idToken: 'id-2'`
- persisted session still keeps old `refreshToken`
- `getBearerToken()` returns `'id-2'`

8. `clears session when refresh fails during restore`

Setup:

- seed expired stored session
- mock token refresh failure with non-OK response

Action:

- call `restoreSession()`

Assert:

- returns `false`
- auth storage cleared
- `isAuthenticated() === false`

9. `shares one refresh request across parallel getBearerToken calls`

Setup:

- seed expired stored session
- mock token refresh using deferred promise

Action:

- call `Promise.all([authSession.getBearerToken(), authSession.getBearerToken()])`
- resolve deferred response once

Assert:

- token endpoint called exactly once
- both calls resolve to the same refreshed `id_token`
- persisted session updated once

10. `clears session when single-flight refresh fails`

Setup:

- seed expired stored session
- mock deferred refresh that rejects or returns non-OK

Action:

- call two parallel `getBearerToken()` requests

Assert:

- one refresh request only
- auth storage cleared
- both callers reject

11. `returns false and clears session when unauthorized handling runs without a cognito refresh token`

Setup:

- seed auth storage without `refreshToken`, or use non-cognito mode
- ensure a session exists so clearing behavior is observable

Action:

- call `handleUnauthorizedResponse()`

Assert:

- returns `false`
- auth storage cleared
- `isAuthenticated() === false`

12. `refreshes session when unauthorized handling runs with a cognito refresh token`

Setup:

- seed Cognito session with expired or stale token and `refreshToken`
- mock refresh response:
  - `access_token: 'access-2'`
  - `id_token: 'id-2'`
  - `expires_in: 3600`

Action:

- call `handleUnauthorizedResponse()`

Assert:

- returns `true`
- session updated
- `getBearerToken()` returns `'id-2'`

13. `uses dev auth token mode without cognito restore logic`

Setup:

- `VITE_DEV_AUTH_TOKEN = 'dev:owner'`

Action:

- import auth session
- call `restoreSession()`
- call `getBearerToken()`

Assert:

- `mode === 'dev'`
- `restoreSession()` returns `true`
- `getBearerToken()` returns `'dev:owner'`
- `fetch` not called

14. `startLogin stores callback state and redirects to authorize url`

Setup:

- Cognito env enabled
- mock PKCE helpers to return:
  - `codeVerifier = 'verifier-123'`
  - `state = 'state-123'`
  - `nonce = 'nonce-123'`
  - `codeChallenge = 'challenge-123'`

Action:

- call `startLogin()`

Assert:

- callback storage exactly matches:
  - `codeVerifier: 'verifier-123'`
  - `state: 'state-123'`
  - `nonce: 'nonce-123'`
- `window.location.assign` called once
- assigned URL includes:
  - `/oauth2/authorize`
  - `response_type=code`
  - `client_id=client-123`
  - encoded redirect URI
  - `scope=openid+email+profile`
  - `code_challenge_method=S256`
  - `code_challenge=challenge-123`
  - `state=state-123`
  - `nonce=nonce-123`

15. `logout clears session and redirects to cognito logout in cognito mode`

Setup:

- seed auth storage
- seed callback storage

Action:

- call `logout()`

Assert:

- auth storage cleared
- callback storage cleared
- `window.location.assign` called with URL containing:
  - `/logout`
  - `client_id=client-123`
  - encoded logout URI

## File 2: `src/composables/useApiClient.test.js`

Create a new file.

### Shared setup

- `vi.resetModules()` in `beforeEach`
- stub `fetch`
- mock `./useAuthSession.js` with mutable spies:
  - `mode`
  - `getBearerToken`
  - `handleUnauthorizedResponse`

Suggested mutable mock shape:

- `const authSessionMock = { mode: 'dev', getBearerToken: vi.fn(), handleUnauthorizedResponse: vi.fn() }`
- `vi.mock('./useAuthSession.js', () => ({ useAuthSession: () => authSessionMock }))`

### Add these tests

1. `attaches dev bearer token to requests`

Setup:

- `mode = 'dev'`
- `getBearerToken -> 'dev:owner'`
- fetch returns `200`

Action:

- call `useApiClient().getMe()`

Assert:

- fetch called with `authorization: Bearer dev:owner`

2. `attaches cognito id token to requests`

Setup:

- `mode = 'cognito'`
- `getBearerToken -> 'id-token-123'`
- fetch returns `200`

Action:

- call `useApiClient().getMe()`

Assert:

- fetch called with `authorization: Bearer id-token-123`

3. `adds content type for json body requests`

Setup:

- any auth mode
- fetch returns `200`

Action:

- call `createProfile('Ember')`

Assert:

- request has `content-type: application/json`
- body equals `{"name":"Ember"}`

4. `retries once after 401 in cognito mode and uses a refreshed bearer token`

Setup:

- `mode = 'cognito'`
- `getBearerToken` returns `'id-token-old'` on first call and `'id-token-new'` on second call
- first fetch returns `401`
- `handleUnauthorizedResponse -> true`
- second fetch returns `200` with `{ ok: true }`

Action:

- call `getMe()`

Assert:

- fetch called twice
- `handleUnauthorizedResponse` called once
- first request has `authorization: Bearer id-token-old`
- second request has `authorization: Bearer id-token-new`
- result equals second response payload

5. `does not retry when refresh fails after 401`

Setup:

- `mode = 'cognito'`
- first fetch returns `401`
- `handleUnauthorizedResponse -> false`

Action:

- call `getMe()`

Assert:

- fetch called once
- throws `ApiError` with status `401`

6. `does not retry more than once when second response is also 401`

Setup:

- `mode = 'cognito'`
- first fetch returns `401`
- `handleUnauthorizedResponse -> true`
- second fetch returns `401`

Action:

- call `getMe()`

Assert:

- fetch called exactly twice
- `handleUnauthorizedResponse` called once
- throws `ApiError`

7. `does not refresh and retry outside cognito mode`

Setup:

- `mode = 'dev'`
- fetch returns `401`

Action:

- call `getMe()`

Assert:

- `handleUnauthorizedResponse` not called
- fetch called once
- throws `ApiError`

## Implementation Order

1. Expand `src/composables/useAuthSession.test.js`
2. Add direct `handleUnauthorizedResponse()` coverage in `src/composables/useAuthSession.test.js`
3. Add deterministic `startLogin()` coverage by mocking PKCE helpers
4. Add `src/composables/useApiClient.test.js`
5. Run targeted tests:
   - `npm test -- --run src/composables/useAuthSession.test.js src/composables/useApiClient.test.js`
6. Run auth-adjacent regression tests:
   - `npm test -- --run src/App.test.js src/composables/useAppBootstrap.test.js`

## Definition Of Done

- Callback failure and success branches are directly covered.
- Stored session restore and refresh branches are directly covered.
- Parallel refresh is proven single-flight.
- `handleUnauthorizedResponse()` is directly covered for success and failure paths.
- API client retry behavior is proven one-shot, mode-aware, and uses a refreshed bearer token on retry.
- Dev token mode remains unchanged.
