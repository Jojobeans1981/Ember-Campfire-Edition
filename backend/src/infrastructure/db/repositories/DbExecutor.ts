import type { Sql, TransactionSql } from 'postgres';

import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';
import { asSqlTransaction } from '../transaction/Transaction';

export type DbExecutor = Sql | TransactionSql;

export const resolveDbExecutor = (database: Database, transaction?: Transaction): DbExecutor => {
  return transaction === undefined ? database.sql : asSqlTransaction(transaction).sql;
};
