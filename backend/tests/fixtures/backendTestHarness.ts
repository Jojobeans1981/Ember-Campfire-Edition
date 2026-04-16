import { AppendEventsUseCase } from '../../src/application/use-cases/AppendEventsUseCase';
import { CreateProfileUseCase } from '../../src/application/use-cases/CreateProfileUseCase';
import { GetAccountUseCase } from '../../src/application/use-cases/GetAccountUseCase';
import { GetCurrentUserUseCase } from '../../src/application/use-cases/GetCurrentUserUseCase';
import { GetHealthCheckUseCase } from '../../src/application/use-cases/GetHealthCheckUseCase';
import { GetProfileProgressUseCase } from '../../src/application/use-cases/GetProfileProgressUseCase';
import { ListProfilesUseCase } from '../../src/application/use-cases/ListProfilesUseCase';
import { SubmitProgressOperationBatchUseCase } from '../../src/application/use-cases/SubmitProgressOperationBatchUseCase';
import { SubmitProgressSnapshotUseCase } from '../../src/application/use-cases/SubmitProgressSnapshotUseCase';
import {
  AppendOnlyEventService,
  IdentityProvisioningService,
  ProfileAccessService,
  ProgressSyncService,
  XpDerivationService
} from '../../src/application/services';
import { DevAuthProvider, mapDevUsersToProvisionableIdentities } from '../../src/infrastructure/auth';
import { loadConfig } from '../../src/infrastructure/config/env';
import {
    PostgresDatabase,
    MigrationRunner,
    SqlAccountRepository,
    SqlEventRepository,
    SqlProfileProgressRepository,
  SqlProfileRepository,
  SqlProgressOperationRepository,
  SqlUserRepository
} from '../../src/infrastructure/db';
import { createHttpServer } from '../../src/transport/http/server';

const migrationsDirectory = new URL('../../src/infrastructure/db/migrations/', import.meta.url);

export const createTestHarness = async () => {
  const config = loadConfig();
  const database = new PostgresDatabase(config.db);
  const migrationRunner = new MigrationRunner(database, migrationsDirectory);
  const accountRepository = new SqlAccountRepository(database);
  const eventRepository = new SqlEventRepository(database);
  const userRepository = new SqlUserRepository(database);
  const profileRepository = new SqlProfileRepository(database);
  const profileProgressRepository = new SqlProfileProgressRepository(database);
  const progressOperationRepository = new SqlProgressOperationRepository(database);
  const clock = {
    now: () => new Date('2026-04-15T12:00:00.000Z')
  };
  const idGenerator = {
    generate: () => crypto.randomUUID()
  };
  const authProvider = new DevAuthProvider({
    env: config.env,
    users: config.auth.devUsers
  });
  const identityProvisioningService = new IdentityProvisioningService({
    userRepository,
    accountRepository,
    transactionManager: database.transactionManager,
    idGenerator,
    clock,
    provisionableIdentities: mapDevUsersToProvisionableIdentities(config.auth.devUsers)
  });

  await database.connect();
  await migrationRunner.runPending();

  const profileAccessService = new ProfileAccessService(profileRepository);
  const xpDerivationService = new XpDerivationService();
  const appendOnlyEventService = new AppendOnlyEventService({
    eventRepository,
    transactionManager: database.transactionManager,
    idGenerator,
    clock
  });
  const progressSyncService = new ProgressSyncService({
    profileProgressRepository,
    progressOperationRepository,
    transactionManager: database.transactionManager,
    xpDerivationService,
    clock
  });

  const server = createHttpServer({
    config,
    getHealthCheckUseCase: new GetHealthCheckUseCase(clock),
    getCurrentUserUseCase: new GetCurrentUserUseCase(userRepository),
    getAccountUseCase: new GetAccountUseCase(accountRepository),
    listProfilesUseCase: new ListProfilesUseCase(profileRepository),
    createProfileUseCase: new CreateProfileUseCase({
      profileRepository,
      idGenerator,
      clock
    }),
    getProfileProgressUseCase: new GetProfileProgressUseCase({
      profileAccessService,
      profileProgressRepository,
      clock
    }),
    submitProgressOperationBatchUseCase: new SubmitProgressOperationBatchUseCase({
      profileAccessService,
      progressSyncService
    }),
    submitProgressSnapshotUseCase: new SubmitProgressSnapshotUseCase({
      profileAccessService,
      profileProgressRepository,
      transactionManager: database.transactionManager,
      xpDerivationService,
      clock
    }),
    appendEventsUseCase: new AppendEventsUseCase({
      profileAccessService,
      appendOnlyEventService
    }),
    authProvider,
    identityProvisioningService
  });

  const truncateAll = async () => {
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
  };

  return {
    config,
    database,
    server,
    accountRepository,
    userRepository,
    profileRepository,
    profileProgressRepository,
    eventRepository,
    progressOperationRepository,
    appendOnlyEventService,
    progressSyncService,
    identityProvisioningService,
    authProvider,
    truncateAll,
    async close() {
      await database.close();
    }
  };
};

export type BackendTestHarness = Awaited<ReturnType<typeof createTestHarness>>;
