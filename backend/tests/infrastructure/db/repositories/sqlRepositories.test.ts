import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import type { Account } from '../../../../src/domain/models/Account';
import type { ProfileProgress } from '../../../../src/domain/models/ProfileProgress';
import type { ProgressOperation } from '../../../../src/domain/models/ProgressOperation';
import type { Profile } from '../../../../src/domain/models/Profile';
import type { User } from '../../../../src/domain/models/User';
import { loadConfig } from '../../../../src/infrastructure/config/env';
import { PostgresDatabase } from '../../../../src/infrastructure/db/PostgresDatabase';
import { MigrationRunner } from '../../../../src/infrastructure/db/migrations/MigrationRunner';
import {
  SqlAccountRepository,
  SqlEventRepository,
  SqlProfileProgressRepository,
  SqlProfileRepository,
  SqlProgressOperationRepository,
  SqlUserRepository
} from '../../../../src/infrastructure/db/repositories';
import { mapEventRow, type EventRow } from '../../../../src/infrastructure/db/repositories/mappers/eventRowMapper';
import {
  mapProgressOperationRow,
  type ProgressOperationRow
} from '../../../../src/infrastructure/db/repositories/mappers/progressOperationRowMapper';

interface CountRow {
  count: number;
}

const createTimestamp = (seed: string) => new Date(seed);

const createAccount = (overrides: Partial<Account> = {}): Account => ({
  id: crypto.randomUUID(),
  name: 'Campfire Household',
  type: 'family',
  createdAt: createTimestamp('2026-04-15T09:00:00.000Z'),
  updatedAt: createTimestamp('2026-04-15T09:00:00.000Z'),
  ...overrides
});

const createUser = (accountId: string, overrides: Partial<User> = {}): User => ({
  id: crypto.randomUUID(),
  accountId,
  email: 'guardian@example.com',
  displayName: 'Guardian',
  role: 'owner',
  authProvider: 'dev',
  authSubject: crypto.randomUUID(),
  createdAt: createTimestamp('2026-04-15T09:05:00.000Z'),
  updatedAt: createTimestamp('2026-04-15T09:05:00.000Z'),
  ...overrides
});

const createProfile = (accountId: string, overrides: Partial<Profile> = {}): Profile => ({
  id: crypto.randomUUID(),
  accountId,
  name: 'Ember',
  createdAt: createTimestamp('2026-04-15T09:10:00.000Z'),
  updatedAt: createTimestamp('2026-04-15T09:10:00.000Z'),
  ...overrides
});

describe('SQL repositories against Postgres', () => {
  const config = loadConfig();
  const database = new PostgresDatabase(config.db);
  const migrationRunner = new MigrationRunner(database, new URL('../../../../src/infrastructure/db/migrations/', import.meta.url));
  const accountRepository = new SqlAccountRepository(database);
  const userRepository = new SqlUserRepository(database);
  const profileRepository = new SqlProfileRepository(database);
  const profileProgressRepository = new SqlProfileProgressRepository(database);
  const progressOperationRepository = new SqlProgressOperationRepository(database);
  const eventRepository = new SqlEventRepository(database);

  beforeAll(async () => {
    await database.connect();
    await migrationRunner.runPending();
  });

  beforeEach(async () => {
    await database.sql.unsafe(`
      truncate table
        event_log,
        progress_operations,
        profile_progress,
        profiles,
        users,
        accounts
      restart identity cascade
    `);
  });

  afterAll(async () => {
    await database.close();
  });

  test('persists and looks up accounts, users, and profiles with optional transactions', async () => {
    const account = createAccount();
    const user = createUser(account.id);
    const profile = createProfile(account.id);

    await database.transactionManager.withTransaction(async (transaction) => {
      await accountRepository.insert(account, transaction);
      await userRepository.insert(user, transaction);
      await profileRepository.insert(profile, transaction);

      expect(await accountRepository.getById(account.id, transaction)).toEqual(account);
      expect(await userRepository.getById(user.id, transaction)).toEqual(user);
      expect(await profileRepository.getById(profile.id, transaction)).toEqual(profile);
    });

    expect(await accountRepository.getById(account.id)).toEqual(account);
    expect(await userRepository.getById(user.id)).toEqual(user);
    expect(await userRepository.getByAuthIdentity(user.authProvider, user.authSubject)).toEqual(user);
    expect(await userRepository.listByAccountId(account.id)).toEqual([user]);
    expect(await profileRepository.getById(profile.id)).toEqual(profile);
    expect(await profileRepository.listByAccountId(account.id)).toEqual([profile]);
  });

  test('round-trips profile_progress JSON fields through Postgres', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const progress: ProfileProgress = {
      profileId: profile.id,
      version: 7,
      ufliProgress: {
        '001': {
          lessonComplete: true,
          activitiesComplete: {
            speech: true,
            build: false
          },
          connectedTextRead: true
        }
      },
      xp: 125,
      selectedFriend: {
        id: 'foxfire',
        name: 'Foxfire',
        file: 'friends/foxfire.json'
      },
      skillState: {
        decoder: {
          streak: 4,
          lastLessonId: '001'
        },
        unlocked: ['speech', 'match'],
        tuning: {
          difficulty: 'gentle'
        }
      },
      skillStateSchemaVersion: 3,
      updatedAt: createTimestamp('2026-04-15T09:20:00.000Z')
    };

    await accountRepository.insert(account);
    await profileRepository.insert(profile);
    await profileProgressRepository.upsert(progress);

    expect(await profileProgressRepository.getByProfileId(profile.id)).toEqual(progress);
  });

  test('dedupes duplicate progress operations by profile and client operation id at the persistence boundary', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const operation: ProgressOperation = {
      profileId: profile.id,
      clientOperationId: 'client-op-1',
      baseVersion: 6,
      type: 'replace_skill_state',
      payload: {
        skillState: {
          decoder: {
            streak: 9
          }
        },
        skillStateSchemaVersion: 5
      },
      createdAt: createTimestamp('2026-04-15T09:25:00.000Z')
    };
    const receivedAt = createTimestamp('2026-04-15T09:26:00.000Z');

    await accountRepository.insert(account);
    await profileRepository.insert(profile);
    await progressOperationRepository.recordApplied({
      operation,
      appliedSnapshotVersion: 7,
      receivedAt
    });
    await progressOperationRepository.recordRejected({
      operation,
      code: 'duplicate',
      message: 'should be ignored by unique constraint',
      receivedAt: createTimestamp('2026-04-15T09:27:00.000Z')
    });

    expect(await progressOperationRepository.hasClientOperation(profile.id, operation.clientOperationId)).toBe(true);

    const countRows = await database.sql<CountRow[]>`
      select count(*)::int as count
      from progress_operations
      where profile_id = ${profile.id}
        and client_operation_id = ${operation.clientOperationId}
    `;
    expect(countRows[0]?.count).toBe(1);

    const rows = await database.sql<ProgressOperationRow[]>`
      select id, profile_id, client_operation_id, base_version, operation_type, payload, status, applied_snapshot_version, error_code, error_message, received_at
      from progress_operations
      where profile_id = ${profile.id}
        and client_operation_id = ${operation.clientOperationId}
    `;
    expect(mapProgressOperationRow(rows[0]!)).toEqual({
      operation: {
        ...operation,
        createdAt: receivedAt
      },
      status: 'applied',
      appliedSnapshotVersion: 7,
      errorCode: null,
      errorMessage: null,
      receivedAt
    });
  });

  test('dedupes duplicate events by profile and client event id at the persistence boundary', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);
    const event = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      clientEventId: 'client-event-1',
      eventType: 'profile.progress.updated',
      occurredAt: createTimestamp('2026-04-15T09:30:00.000Z'),
      schemaVersion: 1,
      payload: {
        version: 8,
        selectedFriend: {
          id: 'foxfire'
        }
      },
      receivedAt: createTimestamp('2026-04-15T09:31:00.000Z')
    };

    await accountRepository.insert(account);
    await profileRepository.insert(profile);
    expect(await eventRepository.append(event)).toBe(true);
    expect(await eventRepository.append({
      ...event,
      id: crypto.randomUUID(),
      payload: {
        version: 999
      }
    })).toBe(false);

    expect(await eventRepository.hasClientEvent(profile.id, event.clientEventId)).toBe(true);

    const countRows = await database.sql<CountRow[]>`
      select count(*)::int as count
      from event_log
      where profile_id = ${profile.id}
        and client_event_id = ${event.clientEventId}
    `;
    expect(countRows[0]?.count).toBe(1);

    const rows = await database.sql<EventRow[]>`
      select id, profile_id, client_event_id, event_type, occurred_at, schema_version, payload, received_at
      from event_log
      where profile_id = ${profile.id}
        and client_event_id = ${event.clientEventId}
    `;
    expect(mapEventRow(rows[0]!)).toEqual(event);
  });

  test('rolls back multi-table writes when a transaction fails mid-flight', async () => {
    const account = createAccount();
    const profile = createProfile(account.id);

    await expect(database.transactionManager.withTransaction(async (transaction) => {
      await accountRepository.insert(account, transaction);
      await profileRepository.insert(profile, transaction);
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await accountRepository.getById(account.id)).toBeNull();
    expect(await profileRepository.getById(profile.id)).toBeNull();
  });
});
