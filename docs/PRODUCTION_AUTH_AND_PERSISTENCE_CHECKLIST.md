# Production Auth And Persistence Checklist

This checklist is the execution plan for making the deployed frontend and backend app work correctly in production while keeping the existing local dev bearer-token flow intact.

Use this document as the source of truth for implementation sequencing and progress tracking. It is written so a coding agent can follow it file by file.

## Scope

- [ ] Production auth uses Cognito Hosted UI with authorization code flow and PKCE.
- [ ] Development auth continues to use `VITE_DEV_AUTH_TOKEN` and backend `Bearer dev:*` auth.
- [ ] One Cognito login provisions one local household account.
- [ ] Production users can create/select profiles, save canonical progress to PostgreSQL, log out, log back in, and see the same data.
- [ ] Profile-scoped state remains isolated per account and per profile.
- [ ] Bootstrap cache, auth session state, and profile cache are isolated so one Cognito household can never hydrate another household's data.
- [ ] No new third-party frontend or backend auth dependency is introduced for the auth flow.
- [ ] Backend bearer auth in Cognito mode uses the Cognito `id_token` for the first release.
- [ ] Backend Cognito token validation for the first release checks signature, JWT structure, `alg = RS256`, `iss`, `token_use = id`, `exp`, and `aud = app client ID`.

## Guardrails

- [ ] Keep dev mode working end to end while production auth is added.
- [ ] Do not remove `DevAuthProvider`.
- [ ] Do not remove `VITE_DEV_AUTH_TOKEN` support.
- [ ] Do not change the backend account/profile data model unless required for Cognito identity mapping.
- [ ] Keep one Cognito identity mapped to exactly one local user and one local account for the first production release.
- [ ] Do not introduce Hosted UI support into local dev unless explicitly needed later.
- [ ] Do not add a new package dependency to either root `package.json` or `backend/package.json` for auth.
- [ ] In Cognito mode, do not hydrate persisted `currentUser`, `account`, or `profiles` until a restored or newly established session identifies the authenticated user.
- [ ] Cognito token refresh must use a single shared in-flight refresh promise so parallel API calls do not race each other.
- [ ] Prefer a Cognito-managed prefix domain for the first release unless a custom auth domain is explicitly required later.

## Phase 1: Terraform And Deployment Wiring

### Task Group 1 — Cognito Hosted UI Terraform

- [ ] Update `infra/cognito.tf`.
- [ ] Keep `aws_cognito_user_pool.app` in place.
- [ ] Keep `aws_cognito_user_pool_client.spa` in place and extend it.
- [ ] Add `allowed_oauth_flows_user_pool_client = true` to `aws_cognito_user_pool_client.spa`.
- [ ] Add `allowed_oauth_flows = ["code"]` to `aws_cognito_user_pool_client.spa`.
- [ ] Add `allowed_oauth_scopes = ["openid", "email", "profile"]` to `aws_cognito_user_pool_client.spa`.
- [ ] Add `callback_urls = ["https://app.readwithember.com/auth/callback"]` to `aws_cognito_user_pool_client.spa`.
- [ ] Add `logout_urls = ["https://app.readwithember.com/"]` to `aws_cognito_user_pool_client.spa`.
- [ ] Keep `generate_secret = false` for the SPA client.
- [ ] Add `aws_cognito_user_pool_domain` using a Cognito-managed domain prefix.
- [ ] Prefer a Cognito-managed prefix domain instead of a Cognito custom domain for the first release.
- [ ] Ensure the domain prefix uses a deterministic, environment-safe value derived from existing locals if possible.
- [ ] Validate that the chosen prefix is legal for Cognito prefix domains and does not use reserved terms such as `aws`, `amazon`, or `cognito`.
- [ ] Validate that the chosen prefix is actually available before rollout.
- [ ] Add a dedicated Terraform variable only if a safe and available prefix cannot be derived from existing locals.

Validation criteria:

- [ ] `terraform validate` passes in `infra/`.
- [ ] Planned output includes a Cognito Hosted UI domain and updated SPA client.
- [ ] The app client still supports refresh tokens.

### Task Group 2 — Terraform Variables And Outputs

- [ ] Review `infra/variables.tf` for any new values required by the Hosted UI domain naming strategy.
- [ ] Only add a new variable if the domain prefix cannot be derived safely from existing locals.
- [ ] Update `infra/outputs.tf`.
- [ ] Add an output for the Cognito Hosted UI domain.
- [ ] Add an output for the Hosted UI authorize endpoint base URL only if deployment tooling will consume it directly.
- [ ] Keep existing user pool ID and client ID outputs.

Validation criteria:

- [ ] Outputs expose useful Cognito values for operators, even if CI retrieves build-time values from AWS directly.

### Task Group 3 — Frontend SPA Deep-Link Support

- [ ] Update `infra/frontend.tf`.
- [ ] Add SPA fallback handling so frontend deep links such as `/auth/callback` serve `index.html` instead of returning S3 or CloudFront 403/404 errors.
- [ ] Use either CloudFront custom error responses or an equivalent rewrite strategy already consistent with the current infra design.
- [ ] Validate that `https://app.readwithember.com/auth/callback` boots the SPA shell.

Validation criteria:

- [ ] Hosted UI callback URLs can load the app successfully in production.

### Task Group 4 — Backend ECS Runtime Configuration

- [ ] Update `infra/secrets.tf`.
- [ ] Keep `COGNITO_USER_POOL_ID`, `COGNITO_USER_POOL_CLIENT_ID`, and `COGNITO_REGION` in the secret.
- [ ] Add `AUTH_PROVIDER = "cognito"` to the backend runtime secret for production, or decide to inject it as plain ECS environment config in `infra/ecs.tf`.
- [ ] Add `COGNITO_DOMAIN` to the secret if backend config parsing or diagnostics will consume it.
- [ ] Update `infra/ecs.tf`.
- [ ] Inject `AUTH_PROVIDER` into the backend container.
- [ ] Inject `COGNITO_USER_POOL_ID` into the backend container.
- [ ] Inject `COGNITO_USER_POOL_CLIENT_ID` into the backend container.
- [ ] Inject `COGNITO_REGION` into the backend container.
- [ ] Inject `COGNITO_DOMAIN` only if the backend config ends up using it.
- [ ] Leave dev-only auth configuration out of production ECS wiring.

Validation criteria:

- [ ] ECS task definition contains all required production auth env vars.
- [ ] No local dev-only auth token is referenced in Terraform.

### Task Group 5 — Frontend Deploy Configuration

- [ ] Update `.github/workflows/frontend-deploy.yml`.
- [ ] Continue building with `VITE_API_BASE_URL=/api`.
- [ ] Inject `VITE_COGNITO_REGION` at build time.
- [ ] Inject `VITE_COGNITO_USER_POOL_ID` at build time.
- [ ] Inject `VITE_COGNITO_USER_POOL_CLIENT_ID` at build time.
- [ ] Inject `VITE_COGNITO_DOMAIN` at build time.
- [ ] Define whether `VITE_COGNITO_DOMAIN` is a bare host or a full `https://` base URL and use that format consistently in URL builders and CI wiring.
- [ ] Inject `VITE_COGNITO_REDIRECT_URI=https://app.readwithember.com/auth/callback` at build time.
- [ ] Inject `VITE_COGNITO_LOGOUT_URI=https://app.readwithember.com/` at build time.
- [ ] Choose a retrieval strategy for these values:
- [ ] Recommended path: read them from AWS in CI with the existing deploy credentials.
- [ ] Acceptable fallback: store them as explicit GitHub environment variables if that is simpler.
- [ ] Do not make Terraform Cloud output access a prerequisite for this rollout.
- [ ] Keep `VITE_DEV_AUTH_TOKEN` out of the production frontend build.

Validation criteria:

- [ ] Production frontend build receives all Cognito values without manual local editing.

## Phase 2: Backend Production Auth

### Task Group 6 — Backend Config Refactor

- [ ] Update `backend/src/infrastructure/config/env.ts`.
- [ ] Add an explicit auth provider mode field, such as `auth.provider` or equivalent.
- [ ] Support at least `dev` and `cognito` provider modes.
- [ ] Continue loading dev user config for dev mode.
- [ ] Add Cognito config parsing for:
- [ ] user pool ID,
- [ ] app client ID,
- [ ] region,
- [ ] optional domain if used.
- [ ] Add validation errors when Cognito mode is enabled but required Cognito config is missing.
- [ ] Preserve current behavior when running locally without Cognito config.

Files to touch:

- [ ] `backend/src/infrastructure/config/env.ts`

Validation criteria:

- [ ] Dev config still boots without Cognito settings.
- [ ] Production config fails fast when Cognito settings are missing.

### Task Group 7 — Cognito Auth Provider Implementation

- [ ] Add `backend/src/infrastructure/auth/cognito/CognitoAuthProvider.ts`.
- [ ] Implement the existing `AuthProvider` interface from `backend/src/infrastructure/auth/AuthProvider.ts`.
- [ ] Parse `Authorization: Bearer <token>`.
- [ ] Reject missing or malformed bearer tokens with `null`.
- [ ] Reject tokens that are not structurally valid three-segment JWTs before JWKS lookup.
- [ ] Verify JWT signature against Cognito JWKS without adding a package dependency.
- [ ] Fetch the JWKS from Cognito using the configured region and user pool ID.
- [ ] Cache the JWKS in memory to avoid refetching on every request.
- [ ] Select the signing key by `kid`.
- [ ] If the `kid` is not present in the cached JWKS, re-fetch the JWKS once before rejecting the token.
- [ ] Validate JWT header `alg = RS256` before signature verification.
- [ ] Only use a matching JWK suitable for RSA signature verification.
- [ ] Verify `RS256` signature using WebCrypto/Bun crypto APIs.
- [ ] Validate `iss` against `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`.
- [ ] Validate token expiry via `exp`.
- [ ] Treat `iat` only as optional sanity data, not a hard rejection rule for the first release.
- [ ] Validate `token_use = id`.
- [ ] Validate the `aud` claim against the configured Cognito app client ID.
- [ ] Document that `aud` validation is specific to `id_token`; Cognito `access_token` validation would use `client_id` instead.
- [ ] Fetch JWKS from `https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json`, not from the Hosted UI domain.
- [ ] Document in code comments or config notes that the frontend must attach the `id_token` to backend requests in Cognito mode.
- [ ] Normalize the verified token into `AuthIdentity` with `provider: 'cognito'`.
- [ ] Map `sub` to `subject`.
- [ ] Treat `sub` as the only required stable identity key.
- [ ] Map email claim to `email` when present.
- [ ] Map `name` or `cognito:username` fallback to `displayName` when present.

Files to create or touch:

- [ ] `backend/src/infrastructure/auth/cognito/CognitoAuthProvider.ts`
- [ ] `backend/src/infrastructure/auth/index.ts`
- [ ] `backend/src/domain/models/AuthIdentity.ts` only if the current shape needs a comment or clarification, not a schema change.

Validation criteria:

- [ ] Valid Cognito token authenticates successfully.
- [ ] Wrong issuer, wrong pool, expired token, wrong token use, and bad signature are rejected.
- [ ] Dev auth remains unaffected.

### Task Group 8 — Backend Provider Selection And Bootstrap

- [ ] Update `backend/src/infrastructure/bootstrap/createApp.ts`.
- [ ] Stop hard-wiring `DevAuthProvider`.
- [ ] Construct `DevAuthProvider` only when auth mode is `dev`.
- [ ] Construct `CognitoAuthProvider` when auth mode is `cognito`.
- [ ] Continue using `IdentityProvisioningService` in both modes.
- [ ] Continue using `mapDevUsersToProvisionableIdentities` only for dev-mode provisioning.
- [ ] Ensure Cognito mode does not depend on dev provisionable identities.

Files to touch:

- [ ] `backend/src/infrastructure/bootstrap/createApp.ts`

Validation criteria:

- [ ] Backend can boot in dev mode and Cognito mode with the same app wiring.

### Task Group 9 — Backend Identity Provisioning For Cognito

- [ ] Update `backend/src/application/services/IdentityProvisioningService.ts`.
- [ ] Keep allowlist-based provisioning for `dev` identities.
- [ ] Auto-provision first-seen `cognito` identities instead of requiring them to be present in `provisionableIdentities`.
- [ ] Define the default role for first-time Cognito users for the first release.
- [ ] Recommended path: first Cognito user for a new account is created as `owner`.
- [ ] Define the default account type for first-time Cognito users.
- [ ] Define deterministic account-name derivation for the first release.
- [ ] Recommended path: derive from display name when present, otherwise email local-part, otherwise a generic fallback such as `Ember Household`.
- [ ] Ensure repeat login with the same Cognito `sub` reuses the same local user and account.
- [ ] Ensure the Cognito auto-provision path does not affect dev-mode provisioning rules.

Files to touch:

- [ ] `backend/src/application/services/IdentityProvisioningService.ts`
- [ ] `backend/src/infrastructure/bootstrap/createApp.ts`

Validation criteria:

- [ ] First Cognito login provisions a household account successfully.
- [ ] Repeat Cognito login resolves the same account.

### Task Group 10 — Backend Tests For Auth And Provisioning

- [ ] Add or update transport auth tests.
- [ ] Add tests for dev mode preserving current behavior.
- [ ] Add tests for Cognito-mode token rejection on malformed or invalid tokens.
- [ ] Add tests for Cognito-mode accepted tokens using generated test JWT fixtures if feasible.
- [ ] Add tests for first-login provisioning via `IdentityProvisioningService` with Cognito identities.
- [ ] Add tests for repeat-login reuse of the same local user/account.
- [ ] Add auth regression coverage for protected progress endpoints, not only `/me`, `/account`, and `/profiles`.
- [ ] Add a test for JWKS re-fetch when the cached key set does not contain the presented `kid`.

Likely files:

- [ ] `backend/tests/transport/accountProfileRoutes.test.ts`
- [ ] `backend/tests/transport/progressRoutes.test.ts`
- [ ] `backend/tests/application/IdentityProvisioningService.test.ts`
- [ ] `backend/tests/fixtures/backendTestHarness.ts`
- [ ] add `backend/tests/infrastructure/CognitoAuthProvider.test.ts` if that layer does not already exist.

Validation criteria:

- [ ] `bun test` passes.
- [ ] Dev auth tests still pass.

## Phase 3: Frontend Hosted UI Auth Flow

### Task Group 11 — Account-Scoped Cache Isolation Prerequisite

- [ ] Complete this task group before shipping any persisted Cognito session work.
- [ ] Refactor `src/composables/usePersistence.js` bootstrap cache storage before shipping persisted Cognito sessions.
- [ ] Stop treating local cache as one global app blob for all signed-in users.
- [ ] Namespace persisted bootstrap and profile cache by authenticated user ID or account ID once `/me` is known.
- [ ] In Cognito mode, do not hydrate persisted `currentUser`, `account`, or `profiles` until restored session identity is known.
- [ ] Preserve a minimal unauthenticated auth-session storage key separate from profile caches.
- [ ] Ensure callback/session temporary storage stays separate from profile/bootstrap cache.
- [ ] Clear or isolate stale cached bootstrap/profile data on logout.
- [ ] Ensure a new Cognito login does not temporarily hydrate another household's cached profiles.
- [ ] Add or update tests covering cache isolation across logout/login as another user.

Files to touch:

- [ ] `src/composables/usePersistence.js`
- [ ] `src/composables/useAppBootstrap.js`
- [ ] `src/App.vue` if logout flow needs explicit cache clearing hooks
- [ ] `src/store/index.js` only if a helper is needed, not for schema redesign
- [ ] `src/composables/useAppBootstrap.test.js`
- [ ] add `src/composables/usePersistence.test.js` if current coverage is not sufficient

Validation criteria:

- [ ] Logging out and logging in as a different user does not leak cached profiles or progress.
- [ ] Cognito mode never flashes another household's cached bootstrap data before identity is known.

### Task Group 12 — Frontend Auth Mode Refactor

- [ ] Add a dedicated frontend auth composable or module instead of keeping auth-token logic inside `src/composables/useApiClient.js`.
- [ ] Keep the refactor small and focused.
- [ ] Add a new file such as `src/composables/useAuthSession.js`.
- [ ] In that module, determine auth mode based on env:
- [ ] dev-token mode when `VITE_DEV_AUTH_TOKEN` is set,
- [ ] Cognito mode when Cognito env values are set and dev token is absent,
- [ ] unauthenticated misconfiguration mode otherwise.
- [ ] Expose helpers for:
- [ ] current mode,
- [ ] getBearerToken,
- [ ] isAuthenticated,
- [ ] startLogin,
- [ ] handleCallback,
- [ ] logout,
- [ ] clearSession.
- [ ] Update `src/composables/useApiClient.js` to call the new auth helper instead of directly reading `VITE_DEV_AUTH_TOKEN`.
- [ ] Keep the public API client methods unchanged so downstream callers do not need broad rewrites.

Files to create or touch:

- [ ] create `src/composables/useAuthSession.js`
- [ ] update `src/composables/useApiClient.js`

Validation criteria:

- [ ] Dev-token mode still sends `Bearer dev:*` exactly as before.
- [ ] Cognito mode can provide a bearer token without changing API call sites.

### Task Group 13 — PKCE Utilities And Hosted UI Redirect

- [ ] Add a small PKCE utility module.
- [ ] Recommended new file: `src/auth/pkce.js` or `src/composables/auth/pkce.js`.
- [ ] Implement code verifier generation using browser crypto.
- [ ] Implement SHA-256 code challenge generation.
- [ ] Implement state parameter generation.
- [ ] Persist PKCE verifier and state just long enough to complete the callback flow.
- [ ] Prefer `sessionStorage` for callback-only auth data.
- [ ] Add a small Cognito URL builder module if it keeps `useAuthSession.js` simpler.
- [ ] Build the Cognito `/oauth2/authorize` URL using:
- [ ] `response_type=code`
- [ ] client ID
- [ ] redirect URI
- [ ] `scope=openid email profile`
- [ ] `code_challenge_method=S256`
- [ ] PKCE challenge
- [ ] state
- [ ] nonce
- [ ] Persist nonce alongside state and verifier just long enough to complete the callback flow.
- [ ] Redirect to Cognito Hosted UI from `startLogin()`.

Files to create or touch:

- [ ] create `src/auth/pkce.js`
- [ ] optionally create `src/auth/cognitoUrls.js`
- [ ] update `src/composables/useAuthSession.js`

Validation criteria:

- [ ] Redirect URL is correct for the deployed app domain.
- [ ] PKCE verifier is not persisted longer than needed.

### Task Group 14 — Callback Handling And Token Exchange

- [ ] Add frontend callback handling for `/auth/callback`.
- [ ] Decide whether to implement callback handling in `src/App.vue` or a dedicated composable consumed there.
- [ ] Recommended path: keep routing manual and handle `/auth/callback` inside `src/App.vue` bootstrap flow by reading `window.location.pathname`.
- [ ] Ensure callback handling runs before `bootstrapApp()` tries `/me`, `/account`, or `/profiles`.
- [ ] Ensure existing Cognito session restore or refresh runs before `bootstrapApp()` as well.
- [ ] Do not hydrate account/profile cache for Cognito mode until authenticated user identity is known.
- [ ] Handle Cognito callback error responses (`error`, `error_description`) before attempting token exchange.
- [ ] Parse `code` and `state` from the callback URL.
- [ ] Validate returned `state` against the stored value.
- [ ] Exchange the auth code for tokens with HTTPS `POST` to Cognito `/oauth2/token` using `fetch`.
- [ ] Send the token exchange request as `application/x-www-form-urlencoded`.
- [ ] Include `grant_type=authorization_code`, `client_id`, `code`, `code_verifier`, and the same `redirect_uri` used at `/oauth2/authorize`.
- [ ] Persist returned tokens in local storage or session storage according to the chosen persistence strategy.
- [ ] Recommended path: persist refresh token and token metadata in local storage under an auth-specific key, unless the app intentionally wants sign-in per tab.
- [ ] Validate the returned `id_token` nonce against the stored nonce before accepting the session.
- [ ] Remove auth code and state from the URL after successful callback handling.
- [ ] Handle failed callback exchange by clearing partial auth state and returning the user to a retryable sign-in UI.

Files to create or touch:

- [ ] update `src/composables/useAuthSession.js`
- [ ] update `src/App.vue`

Validation criteria:

- [ ] Hosted UI login returns to the SPA and establishes a session.
- [ ] Refreshing after callback does not re-run token exchange incorrectly.

### Task Group 15 — Session Restore, Refresh, And Logout

- [ ] In `src/composables/useAuthSession.js`, implement session restoration on startup.
- [ ] Track token expiry timestamps.
- [ ] Refresh tokens when an access/ID token is expired or near expiry.
- [ ] Use Cognito token endpoint refresh grant with the existing app client and refresh token.
- [ ] Send refresh requests with HTTPS `POST` to Cognito `/oauth2/token` using `application/x-www-form-urlencoded`.
- [ ] Include `grant_type=refresh_token`, `client_id`, and `refresh_token` in refresh requests.
- [ ] Keep refreshing and returning the latest `id_token` because backend Cognito mode validates `id_token` for the first release.
- [ ] Preserve the existing refresh token when the refresh response does not include a new `refresh_token`.
- [ ] Persist refreshed token timestamps without discarding retained session fields.
- [ ] Implement refresh as a single-flight operation so parallel requests await one shared in-flight refresh promise.
- [ ] Implement logout by:
- [ ] clearing local auth session state,
- [ ] redirecting to Cognito logout endpoint with client ID and logout URI in Cognito mode,
- [ ] preserving current dev behavior in dev-token mode.
- [ ] On backend `401` in Cognito mode, attempt one refresh-and-retry path before clearing the session.
- [ ] Ensure each original request is retried at most once after refresh.
- [ ] Ensure bootstrap requests to `/me`, `/account`, and `/profiles` do not trigger competing refresh attempts.
- [ ] Only clear Cognito session and restart the login flow when refresh fails, the refresh token is invalid, or a fresh token is still rejected.
- [ ] Document the Cognito managed-login behavior that browser session cookies can keep reauthentication possible for about one hour even if token TTLs are shorter.

Files to touch:

- [ ] `src/composables/useAuthSession.js`
- [ ] `src/composables/useApiClient.js`
- [ ] `src/composables/useAppBootstrap.js`
- [ ] `src/App.vue`

Validation criteria:

- [ ] Returning production user with a refresh token restores their session without manual re-login.
- [ ] Expired session cleanly logs out and reauthenticates.
- [ ] Dev-token mode still works without Cognito session logic.

### Task Group 16 — Frontend Bootstrap UI And Auth UX

- [ ] Update `src/App.vue` unauthenticated UI.
- [ ] Preserve the current dev-token message when running in dev-token mode.
- [ ] Show a production sign-in CTA when running in Cognito mode and the user is not authenticated.
- [ ] Use the sign-in CTA as the default signed-out production UX instead of immediately redirecting on first paint.
- [ ] Add a logout action somewhere appropriate in the app shell once a user is authenticated.
- [ ] Ensure logout does not break profile progress state clearing semantics.
- [ ] Keep the app's manual page-switching approach; do not add `vue-router`.

Files to touch:

- [ ] `src/App.vue`

Validation criteria:

- [ ] Production users see a clear sign-in path instead of the dev-token instruction.
- [ ] Local dev still shows the existing dev-oriented unauthenticated message when no dev token is configured.

### Task Group 17 — Frontend Auth Tests

- [ ] Add tests for dev-token mode remaining unchanged.
- [ ] Add tests for callback parsing and state validation.
- [ ] Add tests for token storage and session restoration.
- [ ] Add tests for API client attaching the right bearer token in each mode.
- [ ] Add tests for `401` handling in Cognito mode.
- [ ] Add tests for single-flight refresh so parallel requests share one refresh attempt.
- [ ] Add tests proving Cognito bootstrap does not hydrate another user's cached household before identity is known.

Likely files:

- [ ] add `src/composables/useAuthSession.test.js`
- [ ] update `src/composables/useApiClient` tests if they exist, or add them.
- [ ] update `src/composables/useAppBootstrap.test.js`
- [ ] update `src/App.test.js`

Validation criteria:

- [ ] `npm test` passes with the new auth flow tests.

## Phase 4: Canonical Progress Persistence Fixes

### Task Group 18 — Make `skillState` Truly Synced

- [ ] Audit all direct `skillState` mutation sites.
- [ ] Replace direct mutations in `src/components/buildings/Campfire.vue`.
- [ ] Replace direct mutations in `src/components/buildings/Workshop.vue`.
- [ ] Replace direct mutations in `src/processors/evidence.js`.
- [ ] Funnel canonical `skillState` updates through `submitOperation('replace_skill_state', ...)` in `src/composables/useProfileProgress.js`.
- [ ] Add a small helper inside `useProfileProgress.js` if needed to submit the current full `skillState` plus `skillStateSchemaVersion`.
- [ ] Keep the change minimal; avoid scattering `replace_skill_state` knowledge across unrelated components.
- [ ] Ensure local canonical state is still updated optimistically and reconciled from the backend snapshot.
- [ ] Ensure `skillState` updates are persisted in the per-profile local cache.

Files to touch:

- [ ] `src/composables/useProfileProgress.js`
- [ ] `src/components/buildings/Campfire.vue`
- [ ] `src/components/buildings/Workshop.vue`
- [ ] `src/processors/evidence.js`

Validation criteria:

- [ ] `skillState` survives refresh and relogin.
- [ ] Backend conflict handling remains the source of truth on stale writes.

### Task Group 19 — Remove Direct Canonical XP Mutations

- [ ] Remove direct `store.xp += ...` writes from legacy components that bypass backend-owned progress.
- [ ] Decide whether those legacy activities should:
- [ ] become telemetry-only,
- [ ] become canonical operations,
- [ ] or stop awarding canonical XP.
- [ ] Implement the minimal option that preserves correctness.
- [ ] Recommended path: stop directly mutating canonical XP in legacy sandbox components unless those actions are explicitly modeled as backend progress operations.

Files to touch:

- [ ] `src/components/buildings/Campfire.vue`
- [ ] `src/components/buildings/Workshop.vue`
- [ ] any other direct `store.xp` mutation sites found during implementation

Validation criteria:

- [ ] Displayed XP always matches backend snapshot-derived XP after sync.

### Task Group 20 — Durable Event Upload

- [ ] Refactor `src/store/events.js` so unsent upload events persist per profile.
- [ ] Extend `src/composables/usePersistence.js` to save and load pending event uploads per profile.
- [ ] Update `src/composables/useEventUpload.js` to read persisted pending events.
- [ ] Retry pending event uploads on app start for the active profile.
- [ ] Retry pending event uploads after reconnect if practical.
- [ ] Flush or retry on page hide using a best-effort approach that does not add large complexity.
- [ ] Flush or isolate pending events on profile switch so one profile's events are not stranded indefinitely.
- [ ] Keep event ingestion telemetry-only; do not let it mutate canonical backend progress.

Files to touch:

- [ ] `src/store/events.js`
- [ ] `src/composables/usePersistence.js`
- [ ] `src/composables/useEventUpload.js`
- [ ] `src/composables/useProfileProgress.js` if profile bootstrap should trigger upload retries
- [ ] `src/App.vue` if global lifecycle hooks are needed for page hide/online events

Validation criteria:

- [ ] Unsent events survive refresh.
- [ ] Uploaded events are deduped safely by the backend.

## Phase 5: End-To-End Validation And Rollout

### Task Group 21 — Backend And Frontend Test Suite Green

- [ ] Run `npm test` from the workspace root.
- [ ] Fix frontend failures without skipping tests.
- [ ] Run `bun test` in `backend/`.
- [ ] Fix backend failures without skipping tests.
- [ ] Run `bun x tsc --noEmit` in `backend/`.

Validation criteria:

- [ ] Both test suites pass.
- [ ] Backend typecheck passes.

### Task Group 22 — Terraform Validation

- [ ] Run `terraform fmt -check` in `infra/` if used by the repo workflow.
- [ ] Run `terraform validate` in `infra/`.
- [ ] Produce a plan and review Cognito, ECS, and outputs changes.

Validation criteria:

- [ ] Terraform config validates cleanly.
- [ ] Planned resources match the Hosted UI rollout design.

### Task Group 23 — Production Auth Manual Verification

- [ ] Deploy infrastructure changes.
- [ ] Deploy backend with Cognito auth mode enabled.
- [ ] Deploy frontend with Cognito Hosted UI config.
- [ ] Visit `https://app.readwithember.com` while signed out.
- [ ] Confirm the production sign-in CTA appears.
- [ ] Launch Cognito Hosted UI from the sign-in CTA.
- [ ] Complete login.
- [ ] Confirm callback returns to `/auth/callback` and settles into the app.
- [ ] Confirm `/me`, `/account`, and `/profiles` succeed.
- [ ] Confirm first login provisions exactly one household account and one local user.
- [ ] Confirm repeat login resolves the same account.
- [ ] Confirm a different Cognito user gets a different local account.

Validation criteria:

- [ ] Production auth is working without breaking dev.

### Task Group 24 — Production Data Persistence Verification

- [ ] Create a profile in production if the account has none.
- [ ] Select a profile.
- [ ] Set selected friend and confirm it reloads after refresh.
- [ ] Complete a lesson and confirm it reloads after refresh.
- [ ] Complete an activity and confirm it reloads after refresh.
- [ ] Confirm XP matches the canonical backend snapshot after refresh.
- [ ] Trigger `skillState` updates and confirm they reload after refresh and relogin.
- [ ] Log out.
- [ ] Log back in as the same Cognito user.
- [ ] Confirm the same profiles and progress are present.
- [ ] Log in as a different Cognito user.
- [ ] Confirm the first user's profiles and progress are not visible.

Validation criteria:

- [ ] The deployed application saves the correct data to PostgreSQL and loads it correctly after login.

## Notes And Decisions

- [ ] Decision: production auth uses Cognito Hosted UI, not custom SPA SRP.
- [ ] Decision: no new auth dependency will be added.
- [ ] Decision: first release prefers a Cognito-managed prefix domain unless a custom auth domain becomes a product requirement.
- [ ] Decision: one Cognito login maps to one local household account for the first release.
- [ ] Decision: dev bearer-token auth remains supported for local development.
- [ ] Decision: frontend attaches the Cognito `id_token` to backend requests in Cognito mode for the first release.
- [ ] Decision: Cognito cache/bootstrap hydration waits until authenticated identity is known.
- [ ] Decision: Cognito refresh uses a single shared in-flight refresh promise.
- [ ] Note: Cognito `/logout` signs the user out of Cognito managed login, but not out of external social or OIDC identity providers if federation is added later.
