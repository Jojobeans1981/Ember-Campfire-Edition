import type { TransactionSql } from 'postgres';
import type { Transaction } from '../../../shared/persistence';

export interface SqlTransaction extends Transaction {
  readonly sql: TransactionSql;
}

export const asSqlTransaction = (transaction: Transaction): SqlTransaction => {
  return transaction as SqlTransaction;
};
