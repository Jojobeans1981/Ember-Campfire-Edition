import { loadConfig } from '../../config/env';
import { PostgresDatabase } from '../PostgresDatabase';
import { MigrationRunner } from './MigrationRunner';

const config = loadConfig();
const database = new PostgresDatabase(config.db);
const migrationRunner = new MigrationRunner(database, new URL('./', import.meta.url));
let isConnected = false;

try {
  await database.connect();
  isConnected = true;

  const appliedMigrations = await migrationRunner.runPending();

  if (appliedMigrations.length === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`Applied migrations: ${appliedMigrations.join(', ')}`);
  }
} catch (error) {
  console.error('Migration run failed.', error);
  process.exitCode = 1;
} finally {
  if (isConnected) {
    await database.close();
  }
}
