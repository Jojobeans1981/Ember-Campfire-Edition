# Backend Implementation Checklist

This checklist is dependency-aware and phase-ordered. Each phase is aligned to the clean architecture and backend standards defined in `docs/BACKEND_ARCHITECTURE.md`.

Use this document as the working checklist during implementation.

## Phase 0: Guardrails And Setup

- [ ] Confirm the backend lives in a separate `backend/` workspace and does not change frontend lesson delivery.
- [ ] Confirm Bun.js, TypeScript, PostgreSQL, and plain SQL are the required backend stack.
- [ ] Confirm no ORM will be used.
- [ ] Confirm the backend progress model must match the current frontend persistence shape only.
- [ ] Confirm a frontend migration is required before the backend can become the source of truth for synced progress.
- [ ] Confirm `selectedFriend` is treated as a profile-scoped preference.
- [ ] Confirm `selectedFriend` uses the canonical shape `{ id: string, name: string, file: string } | null`.
- [ ] Confirm `skillState` will be stored as opaque JSON with guarded stale-write handling.
- [ ] Confirm `skillStateSchemaVersion` starts at `1` for new empty snapshots.
- [ ] Confirm batch progress operations are required from day one.
- [ ] Confirm mixed batches use partial success.
- [ ] Define and document layer import rules:
- [ ] `domain` imports nothing from `application`, `infrastructure`, or `transport`.
- [ ] `application` imports only `domain` and `shared`.
- [ ] `infrastructure` implements domain ports.
- [ ] `transport` depends on `application` and transport-local validation/presentation code.
- [ ] Define per-phase done criteria: compiles, tests pass, no cross-layer leakage, no ORM.
- [ ] Define and document frontend/backend ownership boundaries:
- [ ] frontend session/UI state remains local (`currentPage`, `activeLessonId`, `activeActivity`)
- [ ] backend-owned profile state syncs per active profile (`ufliProgress`, `xp`, `selectedFriend`, `skillState`, `version`)
- [ ] local persistence becomes cached snapshot plus pending sync metadata, not a whole-app source of truth
- [ ] Confirm there is no existing-user local-save migration path because there is no production user base yet.
- [ ] Confirm frontend active-profile selection rules:
- [ ] zero profiles: show create-profile flow
- [ ] one profile: auto-select it
- [ ] multiple profiles: require profile selection
- [ ] invalid persisted `activeProfileId`: clear it and require reselection

Validation criteria:
- [ ] Architecture rules are documented before implementation starts.
- [ ] No phase begins with unresolved boundary questions.
- [ ] Frontend migration prerequisites are documented before transport contracts are treated as final.

## Phase 1: Repository And Runtime Skeleton

- [ ] Create the `backend/` project skeleton.
- [ ] Add `package.json` for Bun.
- [ ] Add `tsconfig.json`.
- [ ] Add `.env.example`.
- [ ] Create `src/index.ts`.
- [ ] Create `src/shared/` for errors, result types, clock, and ID generation.
- [ ] Create `src/domain/`.
- [ ] Create `src/application/`.
- [ ] Create `src/infrastructure/`.
- [ ] Create `src/transport/`.
- [ ] Create `tests/` folders by layer.
- [ ] Add dependency wiring/bootstrap entrypoint.
- [ ] Add a minimal server bootstrap.

Validation criteria:
- [ ] `bun x tsc --noEmit` passes.
- [ ] The server starts without requiring completed business features.
- [ ] The folder structure matches `docs/BACKEND_ARCHITECTURE.md`.

How to check the work:
- [ ] Run `bun x tsc --noEmit`.
- [ ] Start the server and confirm it boots.
- [ ] Inspect imports for any cross-layer violations.

## Phase 2: Domain Core

- [ ] Define domain enums/types:
- [ ] `AccountType`
- [ ] `AuthProviderType`
- [ ] `UserRole`
- [ ] `ProgressOperationType`
- [ ] Define domain models:
- [ ] `Account`
- [ ] `User`
- [ ] `Profile`
- [ ] `ProfileProgress`
- [ ] `ProgressOperation`
- [ ] `AuthIdentity`
- [ ] Define value objects for IDs if used.
- [ ] Define repository interfaces:
- [ ] `AccountRepository`
- [ ] `UserRepository`
- [ ] `ProfileRepository`
- [ ] `ProfileProgressRepository`
- [ ] `ProgressOperationRepository`
- [ ] `EventRepository`
- [ ] Define `ConflictResolutionPolicy` as a pure domain policy.
- [ ] Define `XpPolicy` as a pure domain policy.
- [ ] Lock `ProfileProgress` to existing frontend concepts only:
- [ ] `ufliProgress`
- [ ] `xp`
- [ ] `selectedFriend`
- [ ] `skillState`
- [ ] `skillStateSchemaVersion`
- [ ] `version`

Validation criteria:
- [ ] Domain has no Bun imports.
- [ ] Domain has no SQL imports.
- [ ] Domain has no HTTP imports.
- [ ] No new pedagogical/progress concepts were invented.

How to check the work:
- [ ] Run pure domain tests for XP and conflict rules.
- [ ] Search for forbidden imports from `domain/`.
- [ ] Review `ProfileProgress` against the current frontend persistence shape.

## Phase 3: Database Foundation

- [ ] Add DB configuration loading.
- [ ] Add PostgreSQL connection management.
- [ ] Add transaction abstractions.
- [ ] Add migration runner support.
- [ ] Write `001_init.sql`.
- [ ] Create `accounts` table.
- [ ] Create `users` table.
- [ ] Create `profiles` table.
- [ ] Create `profile_progress` table.
- [ ] Create `progress_operations` table.
- [ ] Create `event_log` table.
- [ ] Add unique constraint on `(auth_provider, auth_subject)`.
- [ ] Add unique constraint on `(profile_id, client_operation_id)`.
- [ ] Add unique constraint on `(profile_id, client_event_id)`.
- [ ] Add supporting indexes.

Validation criteria:
- [ ] Fresh migrations succeed on a clean database.
- [ ] The schema matches `docs/BACKEND_ARCHITECTURE.md`.
- [ ] Required uniqueness constraints exist.

How to check the work:
- [ ] Apply migrations to a fresh local PostgreSQL database.
- [ ] Inspect the resulting schema.
- [ ] Verify constraints and indexes were created.

## Phase 4: SQL Repository Adapters

- [ ] Implement `SqlAccountRepository`.
- [ ] Implement `SqlUserRepository`.
- [ ] Implement `SqlProfileRepository`.
- [ ] Implement `SqlProfileProgressRepository`.
- [ ] Implement `SqlProgressOperationRepository`.
- [ ] Implement `SqlEventRepository`.
- [ ] Add row mapper modules.
- [ ] Centralize JSON field mapping.
- [ ] Ensure transaction objects can be passed into repository methods.
- [ ] Add repository tests against a real test database.

Validation criteria:
- [ ] JSON fields round-trip correctly.
- [ ] Duplicate operation IDs are rejected or deduped safely at the persistence boundary.
- [ ] Repositories contain no merge/conflict business logic.

How to check the work:
- [ ] Run repository tests.
- [ ] Insert and read back `profile_progress` rows with JSON content.
- [ ] Verify duplicate `(profile_id, client_operation_id)` behavior.

## Phase 5: Auth Adapter Layer

- [ ] Define the auth adapter contract fulfilling the domain auth port.
- [ ] Implement `DevAuthProvider`.
- [ ] Define dev user config shape.
- [ ] Define `RequestAuthContext`.
- [ ] Define `CurrentUserContext`.
- [ ] Add `Authorization: Bearer dev:<key>` resolution in development mode.
- [ ] Normalize identities to the shared `AuthIdentity` shape.
- [ ] Implement dev user/account auto-provisioning for configured dev identities in development mode.
- [ ] Add auth middleware wiring.
- [ ] Ensure dev auth uses the same middleware and identity-provisioning flow as future production providers.

Validation criteria:
- [ ] Known dev users authenticate.
- [ ] Unknown dev users fail with `401`.
- [ ] The normalized output shape is provider-agnostic.
- [ ] Downstream handlers and use cases consume only `CurrentUserContext`.

How to check the work:
- [ ] Send requests with valid and invalid `Authorization: Bearer dev:<key>` headers.
- [ ] Verify the same normalized identity shape would work for future Auth0/Cognito providers.
- [ ] Verify provider-specific request details do not leak past auth middleware.

## Phase 6: Identity And Access Application Services

- [ ] Implement `IdentityProvisioningService`.
- [ ] Implement `ProfileAccessService`.
- [ ] Define a current-user context object for application use cases.
- [ ] Enforce that each authenticated user resolves to exactly one account.
- [ ] Enforce that a profile must belong to the current account.
- [ ] Add tests for account and profile access scoping.

Validation criteria:
- [ ] Cross-account profile access is denied.
- [ ] Use cases do not depend on HTTP request objects.
- [ ] Account scoping is enforced consistently.

How to check the work:
- [ ] Run access-control application tests.
- [ ] Exercise profile lookup from the wrong account and verify failure.

## Phase 7: Account And Profile Use Cases

- [ ] Implement `GetCurrentUserUseCase`.
- [ ] Implement `GetAccountUseCase`.
- [ ] Implement `ListProfilesUseCase`.
- [ ] Implement `CreateProfileUseCase`.
- [ ] Define DTOs for user/account/profile responses.
- [ ] Add `GET /me`.
- [ ] Add `GET /account`.
- [ ] Add `GET /profiles`.
- [ ] Add `POST /profiles`.
- [ ] Add request validation and route tests.

Validation criteria:
- [ ] Authenticated users only see their own account.
- [ ] Profiles are created only under the current account.
- [ ] Handlers remain thin.

How to check the work:
- [ ] Call `/me`, `/account`, and `/profiles` with a dev user.
- [ ] Create a profile and verify it belongs to the correct account.

## Phase 8: Progress Read Path

- [ ] Implement `GetProfileProgressUseCase`.
- [ ] Define `ProfileProgressDto`.
- [ ] Implement `GET /profiles/:profileId/progress`.
- [ ] Decide and implement initial empty-progress behavior.
- [ ] Add tests for empty and populated progress snapshots.

Validation criteria:
- [ ] Snapshot shape matches the frontend persistence model.
- [ ] `selectedFriend` is returned as profile-scoped data.
- [ ] `skillState` round-trips unchanged as opaque JSON.

How to check the work:
- [ ] Fetch progress for a new profile.
- [ ] Save a populated progress record and fetch it back.

## Phase 8.5: Frontend Auth And Profile Bootstrap

- [ ] Add a frontend API client for authenticated backend requests.
- [ ] Add app-bootstrap loading for `GET /me`.
- [ ] Add app-bootstrap loading for `GET /profiles`.
- [ ] Add frontend state for `currentUser`, `account`, and `activeProfileId`.
- [ ] Add active-profile bootstrap behavior:
- [ ] zero profiles: show create-profile flow
- [ ] one profile: auto-select it
- [ ] multiple profiles: require profile selection
- [ ] invalid persisted `activeProfileId`: clear it and require reselection
- [ ] Persist only the active profile identifier and session-safe bootstrap cache locally.
- [ ] Keep `currentPage`, `activeLessonId`, and `activeActivity` as local UI state only.
- [ ] Document that `selectedFriend` can no longer be treated as pre-auth global bootstrap state.
- [ ] Add frontend tests for bootstrap success, unauthenticated bootstrap, and profile selection.

Dependencies:
- [ ] Requires Phase 7 account/profile endpoints.
- [ ] Unblocks profile-scoped progress sync work in later phases.

Validation criteria:
- [ ] Frontend can resolve the current user and an active profile before profile-scoped data loads.
- [ ] No frontend code assumes app-global progress after bootstrap.
- [ ] Existing route/page state remains local and does not leak into the backend profile model.

How to check the work:
- [ ] Boot the app and confirm it calls `/me` and `/profiles` before profile-scoped progress features.
- [ ] Select a profile and confirm the active profile ID is retained across reloads.
- [ ] Verify the app no longer depends on `selectedFriend` alone to enter the main flow.

## Phase 9: Progress Sync Domain/Application Logic

- [ ] Implement `XpDerivationService`.
- [ ] Implement `ProgressSyncService`.
- [ ] Support ordered batch processing.
- [ ] Support idempotency by `clientOperationId`.
- [ ] Implement safe auto-rebase for:
- [ ] `complete_lesson`
- [ ] `complete_activity`
- [ ] `complete_connected_text`
- [ ] `set_selected_friend`
- [ ] Reject stale `replace_skill_state` operations.
- [ ] Implement partial success behavior for mixed batches.
- [ ] Increment snapshot version once when any operation applies.
- [ ] Do not increment snapshot version if all operations reject.
- [ ] Recompute XP from canonical progress after applying operations.
- [ ] Add application tests for replay, stale batches, mixed batches, and XP stability.

Validation criteria:
- [ ] Duplicate replay does not inflate XP.
- [ ] Monotonic progress never regresses.
- [ ] Stale `skillState` never silently overwrites newer state.
- [ ] Mixed batches apply safe operations and reject only unsafe stale operations.

How to check the work:
- [ ] Run application tests for conflict resolution.
- [ ] Replay the same batch twice and verify no duplicate rewards.
- [ ] Submit a stale mixed batch and confirm partial success.

## Phase 10: Progress Operations Transport

- [ ] Define request DTO for batch progress operations.
- [ ] Define response DTO for batch progress operations.
- [ ] Add validators for each operation payload type.
- [ ] Implement `SubmitProgressOperationBatchUseCase`.
- [ ] Implement `POST /profiles/:profileId/progress-operations`.
- [ ] Return:
- [ ] `startingVersion`
- [ ] `endingVersion`
- [ ] `applied`
- [ ] `rejected`
- [ ] `snapshot`
- [ ] Add transport tests for invalid payloads, duplicates, stale writes, and mixed partial success.

Validation criteria:
- [ ] The route accepts ordered batches from day one.
- [ ] Validation failures return `422`.
- [ ] Unauthorized requests return `401`.
- [ ] Cross-account access is blocked.
- [ ] The transport layer contains no merge logic.

How to check the work:
- [ ] Submit a valid batch and inspect the response shape.
- [ ] Submit invalid payloads and verify `422`.
- [ ] Submit duplicate operations and verify idempotent behavior.

## Phase 10.5: Frontend Progress Sync Migration

- [ ] Refactor the frontend store so synced progress is profile-scoped.
- [ ] Add frontend fields for snapshot `version`, pending operation queue, sync status, and last sync error.
- [ ] Add `skillStateSchemaVersion` to the frontend state shape.
- [ ] Replace direct progress mutations with backend-compatible operations:
- [ ] `complete_lesson`
- [ ] `complete_activity`
- [ ] `complete_connected_text`
- [ ] `set_selected_friend`
- [ ] `replace_skill_state`
- [ ] Generate a `clientOperationId` for each queued operation.
- [ ] Submit ordered batches to `POST /profiles/:profileId/progress-operations`.
- [ ] Apply the returned canonical snapshot back into the frontend store.
- [ ] Stop treating inline XP increments as authoritative; use server-returned `xp` as canonical.
- [ ] Redesign local persistence to cache the latest profile snapshot, snapshot version, and pending operations.
- [ ] Add frontend tests for replay safety, partial success handling, stale `skillState` rejection, and canonical snapshot replacement.

Dependencies:
- [ ] Requires Phase 8 progress read path for initial snapshot hydration.
- [ ] Requires Phase 9 sync logic and Phase 10 batch transport contract.
- [ ] Depends on Phase 8.5 frontend profile bootstrap to know which profile owns the queue.
- [ ] Unblocks removal of local-only progress persistence as the primary source of truth.

Validation criteria:
- [ ] Frontend progression actions produce backend-compatible operations instead of mutating canonical state ad hoc.
- [ ] Canonical snapshot replacement works after successful and partially successful batches.
- [ ] Duplicate retries do not double-award XP locally.
- [ ] Local persistence can survive reloads without inventing state the backend does not own.

How to check the work:
- [ ] Complete a lesson/activity/story flow and inspect the queued batch payloads.
- [ ] Reload with pending operations and confirm the queue resumes cleanly.
- [ ] Force a stale `replace_skill_state` conflict and verify the frontend reconciles to the returned snapshot.

## Phase 11: Snapshot Recovery Path

- [ ] Implement `SubmitProgressSnapshotUseCase`.
- [ ] Implement `PUT /profiles/:profileId/progress-snapshot`.
- [ ] Reject stale unsafe snapshot writes.
- [ ] Recompute XP server-side for accepted snapshots.
- [ ] Add tests for accepted current-version snapshot writes.
- [ ] Add tests for rejected stale snapshot writes.

Validation criteria:
- [ ] Snapshot writes are recovery-oriented, not the normal sync path.
- [ ] Stale snapshots cannot clobber newer state.
- [ ] Canonical snapshot shape remains stable.

How to check the work:
- [ ] Write a current-version snapshot and read it back.
- [ ] Attempt a stale snapshot overwrite and verify `409` or equivalent conflict handling.

## Phase 11.5: Frontend Recovery Integration

- [ ] Implement a guarded frontend recovery path that can call `PUT /profiles/:profileId/progress-snapshot` only for repair flows.
- [ ] Ensure normal progression sync never uses the snapshot endpoint.
- [ ] Add UX/error handling for recovery conflicts.
- [ ] Add tests proving recovery writes are not used during ordinary lesson completion flows.

Dependencies:
- [ ] Requires Phase 11 snapshot recovery endpoint.
- [ ] Depends on Phase 10.5 frontend sync migration.

Validation criteria:
- [ ] Recovery remains a rare repair path, not the standard write path.
- [ ] Frontend cannot silently clobber newer server state through recovery UI.

How to check the work:
- [ ] Trigger a simulated repair flow and verify the snapshot endpoint is used.
- [ ] Complete ordinary progress updates and verify only the batch endpoint is used.

## Phase 12: Event Ingestion

- [ ] Define event batch DTOs.
- [ ] Implement `AppendEventsUseCase`.
- [ ] Implement `POST /profiles/:profileId/events`.
- [ ] Ensure events are append-only.
- [ ] Ensure events use envelope-level validation only, not per-game payload validation.
- [ ] Add `clientEventId`, `occurredAt`, and `schemaVersion` to the event envelope.
- [ ] Deduplicate event ingestion by `(profile_id, client_event_id)`.
- [ ] Ensure event ingestion does not mutate canonical progress.
- [ ] Add validation and repository tests.

Validation criteria:
- [ ] Events are account-scoped and profile-scoped.
- [ ] Event ingestion is independent from progress sync.
- [ ] The endpoint follows the same auth and profile access rules.
- [ ] Unknown event types and additional payload fields are accepted without transport changes.

How to check the work:
- [ ] Submit events and verify they are stored.
- [ ] Replay the same event batch and verify duplicates are ignored safely.
- [ ] Submit a new event type with additional payload fields and verify it is accepted.
- [ ] Confirm progress snapshot remains unchanged after event writes.

## Phase 12.5: Frontend Event Upload Alignment

- [ ] Decide whether frontend response events remain locally processed, are uploaded for analytics only, or also become an input to future server-side skill-state derivation.
- [ ] If the endpoint is adopted, add a frontend uploader for `POST /profiles/:profileId/events`.
- [ ] Persist/retry unsent events if delivery guarantees are required.
- [ ] Keep event upload independent from canonical progress sync.
- [ ] Document the ownership boundary between uploaded events and `skillState` updates.
- [ ] Add frontend tests for queued event delivery and non-interference with progress sync.

Dependencies:
- [ ] Requires Phase 12 event ingestion endpoint.
- [ ] Depends on Phase 8.5 frontend profile bootstrap.
- [ ] Must not begin until `skillState` ownership is explicitly decided.

Validation criteria:
- [ ] Event upload does not mutate frontend canonical progress directly.
- [ ] The frontend behavior around `skillState` remains coherent after event upload is added.

How to check the work:
- [ ] Submit response events and verify they are stored under the active profile.
- [ ] Confirm normal lesson progression still syncs through progress operations only.

## Phase 13: Full Integration And Hardening

- [ ] Add full-stack integration tests covering auth, profiles, progress reads, progress writes, replay, conflicts, and partial success.
- [ ] Add frontend integration coverage for bootstrap, profile selection, snapshot hydration, queued progress operations, and recovery guardrails.
- [ ] Verify transaction rollback behavior under failure.
- [ ] Verify DB constraints produce expected application errors.
- [ ] Audit the codebase for layer violations.
- [ ] Confirm no ORM dependency was introduced.
- [ ] Confirm the backend still matches `docs/BACKEND_ARCHITECTURE.md`.
- [ ] Confirm the frontend no longer relies on app-global localStorage progress as its canonical source of truth.

Validation criteria:
- [ ] `bun x tsc --noEmit` passes.
- [ ] `bun test` passes.
- [ ] Smoke tests pass against local PostgreSQL.
- [ ] Architecture remains coherent under review.
- [ ] Frontend and backend contracts are consistent under an end-to-end review.

How to check the work:
- [ ] Run all tests.
- [ ] Run local API smoke tests end to end.
- [ ] Inspect imports and dependencies for architecture drift.

## Final Verification Checklist

- [ ] Run migrations on a fresh database.
- [ ] Run `bun x tsc --noEmit`.
- [ ] Run `bun test`.
- [ ] Start the server locally.
- [ ] Call `GET /me` using a valid `Authorization: Bearer dev:<key>` header.
- [ ] Boot the frontend and confirm auth/profile bootstrap succeeds.
- [ ] Create a profile.
- [ ] Fetch its initial progress snapshot.
- [ ] Submit a batch of safe progress operations.
- [ ] Replay the same batch and verify XP does not increase.
- [ ] Submit a stale mixed batch containing `replace_skill_state` and verify partial success.
- [ ] Reload the frontend with pending operations and verify reconciliation against the returned canonical snapshot.
- [ ] Inspect database rows to confirm:
- [ ] snapshot version behavior
- [ ] applied and rejected operation records
- [ ] `selected_friend` stored under `profile_progress`
- [ ] `skill_state` stored as opaque JSON
- [ ] event dedupe by `(profile_id, client_event_id)`

## Definition Of Done

- [ ] Clean architecture boundaries are preserved in structure and imports.
- [ ] The backend progress model matches existing frontend concepts only.
- [ ] Dev auth works and is swappable for future providers.
- [ ] Batch operations, idempotency, and partial success are implemented.
- [ ] `selectedFriend` is profile-scoped.
- [ ] `skillState` is opaque and protected from unsafe stale overwrites.
- [ ] XP is server-derived.
- [ ] The frontend is migrated to profile-scoped synced progress with queued operations and canonical snapshot reconciliation.
- [ ] Tests cover domain rules, application orchestration, persistence behavior, and transport validation.
- [ ] The implementation can be verified with TypeScript checks, tests, and API smoke tests.
