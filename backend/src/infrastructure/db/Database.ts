import type { Sql } from 'postgres';
import type { TransactionManager } from './transaction/TransactionManager';

export interface Database {
  readonly sql: Sql;
  readonly transactionManager: TransactionManager;
  connect(): Promise<void>;
  close(): Promise<void>;
}
