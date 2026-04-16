# Backend Architecture

## Purpose

This document defines the proposed backend architecture for Ember Campfire Edition if the app adds a backend while keeping lesson JSON bundled in the frontend.

The backend owns:
- authentication
- accounts, users, and profiles
- canonical synced profile progress
- batched progress operations
- conflict resolution
- event ingestion

The backend does not own:
- lesson JSON delivery
- runtime lesson playback
- speech/audio execution

Lesson content remains bundled in the frontend and loaded from `src/data/ufli/lessons/`.

## Constraints

- Runtime: Bun.js
- Language: TypeScript
- Database: PostgreSQL
- Persistence access: plain SQL only, no ORM
- Architecture style: clean architecture
- Users belong to exactly one account
- Accounts can have multiple users
- Profiles belong to an account
- Roles: `owner`, `member`
- `selectedFriend` is a profile-scoped preference
- `selectedFriend` uses the canonical shape `{ id: string, name: string, file: string } | null`
- `skillState` is stored as opaque JSON and protected from unsafe stale merges
- `skillStateSchemaVersion` starts at `1`
- Batch progress operations are supported from day one
- Mixed batches use partial success: safe ops apply, stale unsafe ops are rejected

## Clean Architecture

The backend is split into four layers:

1. `domain`
2. `application`
3. `infrastructure`
4. `transport`

### Domain

Contains pure business concepts and rules.

Responsibilities:
- domain models
- value objects
- repository interfaces
- conflict resolution policy
- XP derivation policy

Must not contain:
- SQL
- Bun APIs
- HTTP request/response objects
- auth provider SDK logic

### Application

Contains use cases and orchestration.

Responsibilities:
- current user/account lookup
- profile access checks
- progress sync orchestration
- conflict handling coordination
- event ingestion coordination

Must depend only on domain ports and shared utilities.

### Infrastructure

Contains concrete adapters.

Responsibilities:
- PostgreSQL repositories
- transaction management
- config loading
- auth provider implementations
- ID generation
- clock implementation

Must not invent domain rules.

### Transport

Contains HTTP routing and request/response translation.

Responsibilities:
- route registration
- auth middleware
- request validation
- DTO mapping
- error presentation

Must not contain:
- merge logic
- SQL
- progression policy

## Proposed Project Layout

```text
backend/
  package.json
  tsconfig.json
  .env.example

  src/
    index.ts

    shared/
      errors/
        AppError.ts
        ErrorCodes.ts
      result/
        Result.ts
      ids/
        IdGenerator.ts
        UuidIdGenerator.ts
      time/
        Clock.ts
        SystemClock.ts

    domain/
      types/
        AccountType.ts
        AuthProviderType.ts
        UserRole.ts
        ProgressOperationType.ts
        UfliProgress.ts
        SkillState.ts
      models/
        Account.ts
        User.ts
        Profile.ts
        ProfileProgress.ts
        ProgressOperation.ts
        AuthIdentity.ts
      repositories/
        AccountRepository.ts
        UserRepository.ts
        ProfileRepository.ts
        ProfileProgressRepository.ts
        ProgressOperationRepository.ts
        EventRepository.ts
      services/
        ConflictResolutionPolicy.ts
        XpPolicy.ts
      value-objects/
        LessonId.ts
        ProfileId.ts
        AccountId.ts
        UserId.ts

    application/
      dto/
        MeDto.ts
        AccountDto.ts
        ProfileDto.ts
        ProfileProgressDto.ts
        ProgressOperationBatchRequest.ts
        ProgressOperationBatchResponse.ts
        ProgressSnapshotPutRequest.ts
        EventBatchRequest.ts
      services/
        IdentityProvisioningService.ts
        ProfileAccessService.ts
        ProgressSyncService.ts
        XpDerivationService.ts
      use-cases/
        GetCurrentUserUseCase.ts
        GetAccountUseCase.ts
        ListProfilesUseCase.ts
        CreateProfileUseCase.ts
        GetProfileProgressUseCase.ts
        SubmitProgressOperationBatchUseCase.ts
        SubmitProgressSnapshotUseCase.ts
        AppendEventsUseCase.ts

    infrastructure/
      config/
        env.ts
      auth/
        AuthProvider.ts
        dev/
          DevAuthProvider.ts
          devUsers.ts
        auth0/
          Auth0AuthProvider.ts
        cognito/
          CognitoAuthProvider.ts
      db/
        Database.ts
        PostgresDatabase.ts
        transaction/
          Transaction.ts
          TransactionManager.ts
        migrations/
          001_init.sql
        repositories/
          SqlAccountRepository.ts
          SqlUserRepository.ts
          SqlProfileRepository.ts
          SqlProfileProgressRepository.ts
          SqlProgressOperationRepository.ts
          SqlEventRepository.ts
        mappers/
          accountRowMapper.ts
          userRowMapper.ts
          profileRowMapper.ts
          profileProgressRowMapper.ts

    transport/
      http/
        server.ts
        middleware/
          authMiddleware.ts
          errorMiddleware.ts
          requestContext.ts
        validators/
          commonValidators.ts
          profileValidators.ts
          progressValidators.ts
          eventValidators.ts
        presenters/
          errorPresenter.ts
          profilePresenter.ts
          progressPresenter.ts
        handlers/
          meHandlers.ts
          accountHandlers.ts
          profileHandlers.ts
          progressHandlers.ts
          eventHandlers.ts
        routes/
          meRoutes.ts
          accountRoutes.ts
          profileRoutes.ts
          progressRoutes.ts
          eventRoutes.ts

  tests/
    domain/
    application/
    infrastructure/
    transport/
    fixtures/
```

## Domain Model

### Account

Fields:
- `id`
- `name`
- `type`
- `createdAt`
- `updatedAt`

### User

Fields:
- `id`
- `accountId`
- `email`
- `displayName`
- `role`
- `authProvider`
- `authSubject`
- `createdAt`
- `updatedAt`

Rules:
- a user belongs to exactly one account
- an account can have multiple users

### Profile

Fields:
- `id`
- `accountId`
- `name`
- `createdAt`
- `updatedAt`

### ProfileProgress

This must mirror the current frontend persistence shape and not invent new progression concepts.

Fields:
- `profileId`
- `version`
- `ufliProgress`
- `xp`
- `selectedFriend`
- `skillState`
- `skillStateSchemaVersion`
- `updatedAt`

Notes:
- `selectedFriend` is a profile-scoped preference
- `selectedFriend` should use the canonical shape `{ id: string, name: string, file: string } | null`
- `skillState` is opaque JSON
- `skillState` should be stored as the existing frontend keyed object shape without backend interpretation
- new empty snapshots start with `skillStateSchemaVersion = 1`
- `xp` is server-derived from canonical progress

### ProgressOperationType

Allowed operation types:
- `complete_lesson`
- `complete_activity`
- `complete_connected_text`
- `set_selected_friend`
- `replace_skill_state`

These operations align to the current frontend mutation boundaries.

## Repository Interfaces

The domain defines repository ports only.

- `AccountRepository`
- `UserRepository`
- `ProfileRepository`
- `ProfileProgressRepository`
- `ProgressOperationRepository`
- `EventRepository`

Example shape:

```ts
interface ProfileProgressRepository {
  getByProfileId(profileId: string, tx?: Transaction): Promise<ProfileProgress | null>;
  upsert(progress: ProfileProgress, tx?: Transaction): Promise<void>;
}

interface ProgressOperationRepository {
  hasClientOperation(profileId: string, clientOperationId: string, tx?: Transaction): Promise<boolean>;
  insertApplied(record: AppliedOperationRecord, tx?: Transaction): Promise<void>;
  insertRejected(record: RejectedOperationRecord, tx?: Transaction): Promise<void>;
}
```

## Auth Interface

Define a normalized auth port that all providers implement.

```ts
type RequestAuthContext = {
  headers: Headers;
};

interface AuthProvider {
  authenticate(request: RequestAuthContext): Promise<AuthIdentity | null>;
}
```

Normalized identity:

```ts
type AuthIdentity = {
  provider: 'dev' | 'auth0' | 'cognito';
  subject: string;
  email: string | null;
  displayName: string | null;
};
```

Resolved application context:

```ts
type CurrentUserContext = {
  userId: string;
  accountId: string;
  role: 'owner' | 'member';
};
```

Auth flow for all providers:

1. transport builds `RequestAuthContext` from the incoming HTTP request
2. the configured `AuthProvider` authenticates the request and returns `AuthIdentity | null`
3. `IdentityProvisioningService` resolves that identity to a local user and account
4. auth middleware attaches `CurrentUserContext` to the request context
5. handlers and use cases consume only `CurrentUserContext`, never provider-specific request data

## Dev Auth

Implement `DevAuthProvider` first.

Rules:
- enabled only in development
- reads the `authorization` header using `Bearer dev:<key>`
- maps the dev bearer key to configured dev users
- returns a normalized `AuthIdentity`
- relies on the same `IdentityProvisioningService` flow used by production providers to map that identity to a local user row via `auth_provider + auth_subject`

Required development behavior:
- auto-provision a dev account and user when the configured dev identity does not yet exist locally

This keeps local testing trivial while preserving the same downstream auth consumption path as production.

Suggested config shape:

```ts
type DevAuthUserConfig = {
  key: string;
  subject: string;
  email: string;
  displayName: string;
  accountName: string;
  role: 'owner' | 'member';
};
```

## Application Services

### IdentityProvisioningService

Responsibilities:
- resolve normalized auth identity to a local user
- ensure the user belongs to one account
- create the local account and user automatically for configured dev identities in development when missing

### ProfileAccessService

Responsibilities:
- confirm a requested profile belongs to the current user's account

### ProgressSyncService

Responsibilities:
- load the current snapshot
- process ordered batches of progress operations
- dedupe by `clientOperationId`
- apply safe operations
- reject unsafe stale operations
- recompute XP
- persist the updated snapshot and operation results in one transaction

### XpDerivationService

Responsibilities:
- compute XP from canonical `ufliProgress`

## SQL Schema

Use plain SQL migrations only.

### accounts

```sql
id uuid primary key,
name text not null,
type text not null,
created_at timestamptz not null,
updated_at timestamptz not null
```

### users

```sql
id uuid primary key,
account_id uuid not null references accounts(id),
email text null,
display_name text null,
role text not null,
auth_provider text not null,
auth_subject text not null,
created_at timestamptz not null,
updated_at timestamptz not null,
unique (auth_provider, auth_subject)
```

### profiles

```sql
id uuid primary key,
account_id uuid not null references accounts(id),
name text not null,
created_at timestamptz not null,
updated_at timestamptz not null
```

### profile_progress

```sql
profile_id uuid primary key references profiles(id),
version integer not null,
ufli_progress jsonb not null,
xp integer not null,
selected_friend jsonb null,
skill_state jsonb not null,
skill_state_schema_version integer not null,
updated_at timestamptz not null
```

### progress_operations

```sql
id uuid primary key,
profile_id uuid not null references profiles(id),
client_operation_id text not null,
base_version integer not null,
operation_type text not null,
payload jsonb not null,
status text not null,
applied_snapshot_version integer null,
error_code text null,
error_message text null,
received_at timestamptz not null,
unique (profile_id, client_operation_id)
```

### event_log

```sql
id uuid primary key,
profile_id uuid not null references profiles(id),
client_event_id text not null,
event_type text not null,
occurred_at timestamptz not null,
schema_version integer not null,
payload jsonb not null,
received_at timestamptz not null,
unique (profile_id, client_event_id)
```

Recommended indexes:
- `users(account_id)`
- `profiles(account_id)`
- `progress_operations(profile_id, received_at)`
- `event_log(profile_id, received_at)`

## Snapshot DTO

```ts
type ProfileProgressDto = {
  profileId: string;
  version: number;
  ufliProgress: Record<string, {
    lessonComplete: boolean;
    activitiesComplete: Record<string, boolean>;
    connectedTextRead: boolean;
  }>;
  xp: number;
  selectedFriend: {
    id: string;
    name: string;
    file: string;
  } | null;
  skillState: Record<string, unknown>;
  skillStateSchemaVersion: number;
  updatedAt: string;
};
```

## Batch Operation Contract

Request:

```ts
type ProgressOperationBatchRequest = {
  baseVersion: number;
  operations: Array<{
    clientOperationId: string;
    type:
      | 'complete_lesson'
      | 'complete_activity'
      | 'complete_connected_text'
      | 'set_selected_friend'
      | 'replace_skill_state';
    payload: unknown;
    createdAt: string;
  }>;
};
```

Response:

```ts
type ProgressOperationBatchResponse = {
  profileId: string;
  startingVersion: number;
  endingVersion: number;
  applied: Array<{
    clientOperationId: string;
    appliedVersion: number;
  }>;
  rejected: Array<{
    clientOperationId: string;
    code: 'conflict' | 'invalid' | 'duplicate';
    message: string;
  }>;
  snapshot: ProfileProgressDto;
};
```

## Conflict Resolution

This backend must not use whole-document last-write-wins for profile progress.

### Safe Auto-Rebase Operations

- `complete_lesson`
- `complete_activity`
- `complete_connected_text`
- `set_selected_friend`

### Unsafe Auto-Rebase Operations

- `replace_skill_state`

### Merge Rules

1. `lessonComplete` merges with logical OR
2. `activitiesComplete[type]` merges with logical OR
3. `connectedTextRead` merges with logical OR
4. `selectedFriend` uses last-write-wins
5. `skillState` is replaced only when the incoming batch is not stale
6. `xp` is always recomputed from canonical progress

### Batch Processing Rules

1. Process operations in request order
2. Run the full batch in one transaction
3. Dedupe by `(profile_id, client_operation_id)`
4. Apply safe operations even when `baseVersion` is stale
5. Reject stale `replace_skill_state` operations with `conflict`
6. Allow partial success in mixed batches
7. Increment snapshot version once per batch if at least one operation applies
8. Return the canonical snapshot after processing

This gives the client a strong queueing story:
- monotonic progress is not lost
- duplicate replay is harmless
- stale opaque `skillState` writes are blocked instead of silently corrupting data

## XP Derivation

Do not trust client XP.

Recompute from canonical `ufliProgress` after each successful batch:
- `+100` for each completed lesson
- `+50` for each completed activity
- `+75` for each completed connected text

This matches the current frontend logic and prevents retry inflation.

## API Surface

- `GET /me`
- `GET /account`
- `GET /profiles`
- `POST /profiles`
- `GET /profiles/:profileId/progress`
- `POST /profiles/:profileId/progress-operations`
- `PUT /profiles/:profileId/progress-snapshot`
- `POST /profiles/:profileId/events`

## Frontend Bootstrap Decisions

- there is no existing-user migration path because there is no production user base yet
- if the current account has no profiles, the frontend shows profile creation
- if the current account has one profile, the frontend auto-selects it
- if the current account has multiple profiles, the frontend requires profile selection
- the frontend persists only `activeProfileId` and session-safe bootstrap cache locally
- if a persisted `activeProfileId` is missing or no longer accessible, the frontend clears it and requires reselection

### Endpoint Notes

`POST /profiles/:profileId/progress-operations`
- normal write path
- accepts ordered batches
- returns applied ops, rejected ops, ending version, and canonical snapshot

`PUT /profiles/:profileId/progress-snapshot`
- recovery or repair path only
- should reject unsafe stale writes with `409`

`POST /profiles/:profileId/events`
- append-only ingestion path
- validates a stable event envelope and batch limits
- does not validate game-specific payload internals beyond requiring `payload` to be an object
- accepts new event types without requiring transport changes

## Transport Validation

Validate at the HTTP boundary:
- UUID path parameters
- account/profile ownership
- operation type enum
- payload shape per operation type
- batch size limits

Suggested payload shapes:

```ts
type CompleteLessonPayload = { lessonId: string };
type CompleteActivityPayload = {
  lessonId: string;
  activityType: 'speech' | 'match' | 'blend' | 'build' | 'sentence';
};
type CompleteConnectedTextPayload = { lessonId: string };
type SetSelectedFriendPayload = {
  selectedFriend: {
    id: string;
    name: string;
    file: string;
  } | null;
};
type ReplaceSkillStatePayload = {
  skillState: Record<string, unknown>;
  skillStateSchemaVersion: number;
};
```

For event ingestion, validate only the shared envelope:

```ts
type EventBatchRequest = {
  events: Array<{
    clientEventId: string;
    eventType: string;
    occurredAt: string;
    schemaVersion: number;
    payload: Record<string, unknown>;
  }>;
};
```

Event validation rules:
- require `clientEventId`, `eventType`, `occurredAt`, `schemaVersion`, and `payload`
- require `payload` to be an object
- enforce batch size limits
- accept unknown event types and additional payload fields
- use `(profile_id, client_event_id)` for idempotent retry handling

## Transaction Boundary

For `POST /profiles/:id/progress-operations`:

1. begin transaction
2. verify profile belongs to the current user's account
3. load and lock the `profile_progress` row for update, creating it if needed
4. process operations in order
5. persist applied and rejected operation records
6. recompute XP
7. update snapshot version if any operation applied
8. commit transaction

This ensures the snapshot and operation log cannot diverge.

## Test Plan

### Domain Tests

Files:
- `tests/domain/ConflictResolutionPolicy.test.ts`
- `tests/domain/XpPolicy.test.ts`

Cases:
- lesson completion merges monotonically
- activity completion merges monotonically
- connected text merges monotonically
- selected friend overwrites cleanly
- stale `replace_skill_state` is rejected
- XP derives correctly from canonical progress

### Application Tests

Files:
- `tests/application/ProgressSyncService.test.ts`
- `tests/application/ProfileAccessService.test.ts`
- `tests/application/IdentityProvisioningService.test.ts`

Cases:
- ordered batches apply deterministically
- duplicate `clientOperationId` is idempotent
- stale batches containing only safe ops succeed
- mixed batches partially succeed when `replace_skill_state` conflicts
- version increments once per successful batch
- version does not increment when all ops reject
- XP does not double-count on replay
- profile access is limited to the current account

### Infrastructure Tests

Files:
- `tests/infrastructure/SqlProfileProgressRepository.test.ts`
- `tests/infrastructure/SqlProgressOperationRepository.test.ts`
- `tests/infrastructure/DevAuthProvider.test.ts`

Cases:
- JSON fields round-trip correctly
- unique `(profile_id, client_operation_id)` enforces dedupe
- transaction rollback preserves consistency
- dev auth resolves known users
- dev auth rejects unknown users

### Transport Tests

Files:
- `tests/transport/progressRoutes.test.ts`
- `tests/transport/profileRoutes.test.ts`
- `tests/transport/authMiddleware.test.ts`

Cases:
- invalid payload returns `422`
- unauthorized request returns `401`
- cross-account profile access fails
- partial-success batch returns expected response shape
- snapshot endpoint rejects stale unsafe writes with `409`

## Validation Criteria

### Architectural Validation

- `domain` compiles without importing Bun, SQL, or HTTP code
- SQL exists only under `infrastructure/db`
- route handlers do not contain merge or persistence logic
- auth provider swapping does not affect use-case code

### Functional Validation

- progress shape matches the current frontend save model
- `selectedFriend` remains profile-scoped
- `skillState` remains opaque JSON
- XP is server-derived
- batch writes support partial success

### Data Integrity Validation

- duplicate operations are idempotent
- stale `replace_skill_state` never overwrites newer server state
- monotonic progress fields never regress
- snapshot and operation log remain transactionally consistent

### API Validation

- `POST /profiles/:id/progress-operations` accepts ordered batches
- response includes applied ops, rejected ops, ending version, and snapshot
- `PUT /profiles/:id/progress-snapshot` rejects unsafe stale writes

## Implementation Sequence

1. scaffold the Bun + TypeScript backend
2. add DB connection, transaction manager, and migration runner
3. define domain models, types, repository interfaces, and policies
4. write the initial SQL migration
5. implement SQL repositories and row mappers
6. implement `DevAuthProvider`
7. add auth middleware and identity provisioning
8. implement `/me`, `/account`, and `/profiles`
9. update the frontend bootstrap to resolve the current user, list profiles, and select an active profile before loading synced progress
10. implement `/profiles/:id/progress`
11. refactor the frontend store so canonical progress is profile-scoped and can hydrate from the backend snapshot shape
12. implement `ProgressSyncService` and batch progress endpoint
13. refactor frontend progression writes into queued operations with `clientOperationId`, `baseVersion`, canonical snapshot reconciliation, and server-derived XP
14. implement strict snapshot recovery endpoint
15. add a guarded frontend recovery path that uses the snapshot endpoint only for repair flows
16. implement event ingestion endpoint
17. if event upload is adopted, add frontend event upload without coupling it to canonical progress sync
18. add tests by layer, including frontend integration coverage for bootstrap and sync
19. run full verification and API smoke tests

## How The Implementing Agent Should Check Its Work

### Static Checks

Run:

```bash
bun x tsc --noEmit
bun test
```

Verify:
- no forbidden cross-layer imports
- no ORM dependency added
- TypeScript types and tests pass

### Integration Checks

1. apply migrations to a fresh local PostgreSQL database
2. start the backend locally
3. send `GET /me` with `Authorization: Bearer dev:<key>`
4. create a profile
5. fetch the profile's initial progress snapshot
6. submit a batch containing lesson, activity, and connected text operations
7. replay the same batch and verify XP does not increase
8. submit a stale batch containing `replace_skill_state` plus safe ops and verify partial success

### Manual API Smoke Test Checklist

- `GET /me` returns one user and one account
- `GET /profiles` returns only profiles for the authenticated account
- `GET /profiles/:id/progress` returns the expected snapshot shape
- duplicate `clientOperationId` does not duplicate effects
- stale `replace_skill_state` is rejected while safe ops still apply
- returned XP matches canonical server recomputation

### Data Verification Checklist

- `profile_progress.version` increments correctly
- `progress_operations` records applied and rejected operations
- `selected_friend` is stored under profile progress
- `skill_state` round-trips as opaque JSON unchanged

## Acceptance Criteria

1. clean architecture boundaries are visible in code structure and imports
2. dev auth works and normalizes to the same identity shape future providers will use
3. every user belongs to one account and profiles belong to that account
4. profile progress matches existing frontend concepts only
5. batched progress operations work from day one
6. partial success is implemented for mixed stale batches
7. no ORM is used
8. automated tests cover merge logic, idempotency, access scoping, and transport validation
9. the implementing agent can verify correctness with TypeScript checks, test runs, and API smoke tests
