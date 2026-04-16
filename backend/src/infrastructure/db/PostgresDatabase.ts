import postgres, { type Sql, type TransactionSql } from 'postgres';
import type { DatabaseConfig } from '../config/env';
import type { Transaction } from '../../shared/persistence';
import type { Database } from './Database';
import type { SqlTransaction } from './transaction/Transaction';
import type { TransactionManager } from './transaction/TransactionManager';

class PostgresTransactionManager implements TransactionManager {
  public constructor(private readonly sqlClient: Sql) {}

  public withTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.sqlClient.begin(async (transactionSql) => work(new PostgresTransaction(transactionSql))) as Promise<T>;
  }
}

class PostgresTransaction implements SqlTransaction {
  public constructor(public readonly sql: TransactionSql) {}
}

export class PostgresDatabase implements Database {
  public readonly sql: Sql;
  public readonly transactionManager: TransactionManager;
  private readonly client: Sql;

  public constructor(private readonly config: DatabaseConfig) {
    this.client = postgres(config.connectionString, {
      ssl: config.ssl ? 'require' : false
    });
    this.sql = this.client;
    this.transactionManager = new PostgresTransactionManager(this.client);
  }

  public async connect(): Promise<void> {
    await this.client`select 1`;
  }

  public async close(): Promise<void> {
    await this.client.end();
  }

  public getConnectionString(): string {
    return this.config.connectionString;
  }
}
