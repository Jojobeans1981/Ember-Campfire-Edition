import type { UserRole } from '../../domain/types/UserRole';

export interface AppConfig {
  env: string;
  host: string;
  port: number;
  db: DatabaseConfig;
  auth: AuthConfig;
  cors: CorsConfig;
}

export interface DatabaseConfig {
  connectionString: string;
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
}

export interface AuthConfig {
  provider: 'dev' | 'cognito';
  devUsers: DevAuthUserConfig[];
  cognito: CognitoAuthConfig | null;
  cognitoAutoProvision: boolean;
}

export interface CognitoAuthConfig {
  userPoolId: string;
  clientId: string;
  region: string;
  domain: string | null;
}

export interface CorsConfig {
  allowedOrigins: string[];
}

export interface DevAuthUserConfig {
  key: string;
  subject: string;
  email: string;
  displayName: string;
  accountName: string;
  role: UserRole;
}

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3001;
const DEFAULT_DATABASE_HOST = '127.0.0.1';
const DEFAULT_DATABASE_PORT = 5432;
const DEFAULT_DATABASE_NAME = 'ember_campfire_backend';
const DEFAULT_DATABASE_USER = 'postgres';
const DEFAULT_CORS_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173'
];

export const loadConfig = (): AppConfig => {
  const env = process.env.NODE_ENV ?? 'development';
  const host = process.env.HOST ?? DEFAULT_HOST;
  const port = parsePort(process.env.PORT);
  const db = loadDatabaseConfig();
  const auth = loadAuthConfig(env);
  const cors = loadCorsConfig();

  return { env, host, port, db, auth, cors };
};

const loadAuthConfig = (env: string): AuthConfig => {
  const provider = loadAuthProvider();

  return {
    provider,
    devUsers: loadDevAuthUsers(env, process.env.DEV_AUTH_USERS),
    cognito: provider === 'cognito' ? loadCognitoAuthConfig() : null,
    cognitoAutoProvision: provider === 'cognito'
      ? parseBoolean(process.env.COGNITO_AUTO_PROVISION, 'COGNITO_AUTO_PROVISION', true)
      : false
  };
};

const loadAuthProvider = (): 'dev' | 'cognito' => {
  const value = process.env.AUTH_PROVIDER;

  if (value === undefined || value.trim().length === 0) {
    return 'dev';
  }

  if (value === 'dev' || value === 'cognito') {
    return value;
  }

  throw new Error(`Invalid AUTH_PROVIDER value: ${value}`);
};

const loadCognitoAuthConfig = (): CognitoAuthConfig => ({
  userPoolId: loadRequiredEnvString('COGNITO_USER_POOL_ID'),
  clientId: loadRequiredEnvString('COGNITO_USER_POOL_CLIENT_ID'),
  region: loadRequiredEnvString('COGNITO_REGION'),
  domain: loadOptionalEnvString('COGNITO_DOMAIN')
});

const loadCorsConfig = (): CorsConfig => ({
  allowedOrigins: loadAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)
});

const loadAllowedOrigins = (rawValue: string | undefined): string[] => {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return DEFAULT_CORS_ALLOWED_ORIGINS;
  }

  return rawValue
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin, index, allOrigins) => origin.length > 0 && allOrigins.indexOf(origin) === index);
};

const loadDevAuthUsers = (env: string, rawValue: string | undefined): DevAuthUserConfig[] => {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return env === 'production' ? [] : DEFAULT_DEV_AUTH_USERS;
  }

  const parsed = JSON.parse(rawValue) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('DEV_AUTH_USERS must be a JSON array');
  }

  return parsed.map((entry, index) => parseDevAuthUser(entry, index));
};

const parseDevAuthUser = (value: unknown, index: number): DevAuthUserConfig => {
  if (!isRecord(value)) {
    throw new Error(`DEV_AUTH_USERS[${index}] must be an object`);
  }

  const role = parseUserRole(value.role, `DEV_AUTH_USERS[${index}].role`);

  return {
    key: parseRequiredString(value.key, `DEV_AUTH_USERS[${index}].key`),
    subject: parseRequiredString(value.subject, `DEV_AUTH_USERS[${index}].subject`),
    email: parseRequiredString(value.email, `DEV_AUTH_USERS[${index}].email`),
    displayName: parseRequiredString(value.displayName, `DEV_AUTH_USERS[${index}].displayName`),
    accountName: parseRequiredString(value.accountName, `DEV_AUTH_USERS[${index}].accountName`),
    role
  };
};

const loadDatabaseConfig = (): DatabaseConfig => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    const url = new URL(connectionString);

    return {
      connectionString,
      host: url.hostname,
      port: url.port.length > 0 ? parseInteger(url.port, 'DATABASE_URL port') : DEFAULT_DATABASE_PORT,
      name: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: url.searchParams.get('sslmode') === 'require'
    };
  }

  const host = process.env.DATABASE_HOST ?? DEFAULT_DATABASE_HOST;
  const port = parseInteger(process.env.DATABASE_PORT, 'DATABASE_PORT', DEFAULT_DATABASE_PORT);
  const name = process.env.DATABASE_NAME ?? DEFAULT_DATABASE_NAME;
  const user = process.env.DATABASE_USER ?? DEFAULT_DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD ?? '';
  const ssl = parseBoolean(process.env.DATABASE_SSL, 'DATABASE_SSL', false);

  return {
    connectionString: buildConnectionString({ host, port, name, user, password, ssl }),
    host,
    port,
    name,
    user,
    password,
    ssl
  };
};

const buildConnectionString = (config: Omit<DatabaseConfig, 'connectionString'>): string => {
  const url = new URL('postgres://localhost');

  url.hostname = config.host;
  url.port = String(config.port);
  url.pathname = `/${config.name}`;
  url.username = config.user;
  url.password = config.password;

  if (config.ssl) {
    url.searchParams.set('sslmode', 'require');
  }

  return url.toString();
};

const parsePort = (value: string | undefined): number => {
  return parseInteger(value, 'PORT', DEFAULT_PORT);
};

const parseInteger = (value: string | undefined, name: string, defaultValue?: number): number => {
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Missing required integer value: ${name}`);
    }

    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }

  return parsed;
};

const parseBoolean = (value: string | undefined, name: string, defaultValue: boolean): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`Invalid ${name} value: ${value}`);
};

const parseRequiredString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${name} value`);
  }

  return value.trim();
};

const loadRequiredEnvString = (name: string): string => {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing required environment value: ${name}`);
  }

  return value.trim();
};

const loadOptionalEnvString = (name: string): string | null => {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value.trim();
};

const parseUserRole = (value: unknown, name: string): UserRole => {
  if (value === 'owner' || value === 'member') {
    return value;
  }

  throw new Error(`Invalid ${name} value`);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const DEFAULT_DEV_AUTH_USERS: DevAuthUserConfig[] = [
  {
    key: 'owner',
    subject: 'dev-owner',
    email: 'owner@dev.local',
    displayName: 'Dev Owner',
    accountName: 'Dev Household',
    role: 'owner'
  },
  {
    key: 'member',
    subject: 'dev-member',
    email: 'member@dev.local',
    displayName: 'Dev Member',
    accountName: 'Dev Household',
    role: 'member'
  }
];
