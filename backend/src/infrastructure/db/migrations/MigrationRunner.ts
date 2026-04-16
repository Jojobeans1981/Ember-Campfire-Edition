import { readdir } from 'node:fs/promises';
import type { Database } from '../Database';
import { asSqlTransaction } from '../transaction/Transaction';

interface MigrationFile {
  version: string;
  fileName: string;
  path: URL;
}

interface AppliedMigrationRow {
  version: string;
}

const MIGRATION_TABLE_SQL = `
  create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null
  );
`;

export class MigrationRunner {
  public constructor(
    private readonly database: Database,
    private readonly migrationsDirectory: URL = new URL('./', import.meta.url)
  ) {}

  public async runPending(): Promise<string[]> {
    await this.ensureMigrationTable();

    const migrationFiles = await this.listMigrationFiles();
    const appliedVersions = await this.loadAppliedVersions();
    const pendingMigrations = migrationFiles.filter((migration) => !appliedVersions.has(migration.version));

    for (const migration of pendingMigrations) {
      await this.applyMigration(migration);
    }

    return pendingMigrations.map((migration) => migration.fileName);
  }

  private async ensureMigrationTable(): Promise<void> {
    await this.database.sql.unsafe(MIGRATION_TABLE_SQL);
  }

  private async loadAppliedVersions(): Promise<Set<string>> {
    const rows = await this.database.sql<AppliedMigrationRow[]>`
      select version
      from schema_migrations
    `;

    return new Set(rows.map((row) => row.version));
  }

  private async applyMigration(migration: MigrationFile): Promise<void> {
    const sql = await Bun.file(migration.path).text();

    await this.database.transactionManager.withTransaction(async (transaction) => {
      const transactionSql = asSqlTransaction(transaction).sql;

      await transactionSql.unsafe(sql);
      await transactionSql`
        insert into schema_migrations (version, applied_at)
        values (${migration.version}, ${new Date()})
      `;
    });
  }

  private async listMigrationFiles(): Promise<MigrationFile[]> {
    const directoryEntries = await readdir(this.migrationsDirectory, { withFileTypes: true });

    return directoryEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => ({
        version: entry.name.replace(/\.sql$/, ''),
        fileName: entry.name,
        path: new URL(entry.name, this.migrationsDirectory)
      }));
  }
}
