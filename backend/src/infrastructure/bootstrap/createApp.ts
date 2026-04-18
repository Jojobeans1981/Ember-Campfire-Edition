import { AppendEventsUseCase } from '../../application/use-cases/AppendEventsUseCase';
import { CreateProfileUseCase } from '../../application/use-cases/CreateProfileUseCase';
import { GetAccountUseCase } from '../../application/use-cases/GetAccountUseCase';
import { GetHealthCheckUseCase } from '../../application/use-cases/GetHealthCheckUseCase';
import { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import { GetProfileProgressUseCase } from '../../application/use-cases/GetProfileProgressUseCase';
import { ListProfilesUseCase } from '../../application/use-cases/ListProfilesUseCase';
import { SubmitProgressOperationBatchUseCase } from '../../application/use-cases/SubmitProgressOperationBatchUseCase';
import { SubmitProgressSnapshotUseCase } from '../../application/use-cases/SubmitProgressSnapshotUseCase';
import {
  AppendOnlyEventService,
  IdentityProvisioningService,
  ProfileAccessService,
  ProgressSyncService,
  XpDerivationService
} from '../../application/services';
import { CognitoAuthProvider, DevAuthProvider, mapDevUsersToProvisionableIdentities } from '../auth';
import {
  PostgresDatabase,
    SqlAccountRepository,
    SqlEventRepository,
    SqlProfileProgressRepository,
  SqlProfileRepository,
  SqlProgressOperationRepository,
  SqlUserRepository
} from '../db';
import { SystemClock } from '../../shared/time/SystemClock';
import { UuidIdGenerator } from '../../shared/ids/UuidIdGenerator';
import { loadConfig } from '../config/env';
import { createHttpServer } from '../../transport/http/server';

export interface App {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const getCognitoConfig = (config: ReturnType<typeof loadConfig>) => {
  if (config.auth.cognito === null) {
    throw new Error('Cognito auth config is required when AUTH_PROVIDER=cognito');
  }

  return config.auth.cognito;
};

export const createApp = (): App => {
  const config = loadConfig();
  const clock = new SystemClock();
  const idGenerator = new UuidIdGenerator();
  const database = new PostgresDatabase(config.db);
  const accountRepository = new SqlAccountRepository(database);
  const eventRepository = new SqlEventRepository(database);
  const userRepository = new SqlUserRepository(database);
  const profileRepository = new SqlProfileRepository(database);
  const profileProgressRepository = new SqlProfileProgressRepository(database);
  const progressOperationRepository = new SqlProgressOperationRepository(database);
  const authProvider = config.auth.provider === 'cognito'
    ? new CognitoAuthProvider(getCognitoConfig(config))
    : new DevAuthProvider({
      env: config.env,
      users: config.auth.devUsers
    });
  const identityProvisioningService = new IdentityProvisioningService({
    userRepository,
    accountRepository,
    transactionManager: database.transactionManager,
    idGenerator,
    clock,
    provisionableIdentities: config.auth.provider === 'dev'
      ? mapDevUsersToProvisionableIdentities(config.auth.devUsers)
      : []
  });

  const getHealthCheckUseCase = new GetHealthCheckUseCase(clock);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository);
  const getAccountUseCase = new GetAccountUseCase(accountRepository);
  const listProfilesUseCase = new ListProfilesUseCase(profileRepository);
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
  const createProfileUseCase = new CreateProfileUseCase({
    profileRepository,
    idGenerator,
    clock
  });
  const getProfileProgressUseCase = new GetProfileProgressUseCase({
    profileAccessService,
    profileProgressRepository,
    clock
  });
  const submitProgressOperationBatchUseCase = new SubmitProgressOperationBatchUseCase({
    profileAccessService,
    progressSyncService
  });
  const submitProgressSnapshotUseCase = new SubmitProgressSnapshotUseCase({
    profileAccessService,
    profileProgressRepository,
    transactionManager: database.transactionManager,
    xpDerivationService,
    clock
  });
  const appendEventsUseCase = new AppendEventsUseCase({
    profileAccessService,
    appendOnlyEventService
  });
  const server = createHttpServer({
    config,
    getHealthCheckUseCase,
    getCurrentUserUseCase,
    getAccountUseCase,
    listProfilesUseCase,
    createProfileUseCase,
    getProfileProgressUseCase,
    submitProgressOperationBatchUseCase,
    submitProgressSnapshotUseCase,
    appendEventsUseCase,
    authProvider,
    identityProvisioningService
  });

  return {
    async start() {
      await database.connect();
      server.start();
    },
    async stop() {
      await server.stop();
      await database.close();
    }
  };
};
