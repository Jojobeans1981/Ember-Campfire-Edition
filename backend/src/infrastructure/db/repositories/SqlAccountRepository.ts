import type { Account } from '../../../domain/models/Account';
import type { AccountRepository } from '../../../domain/repositories';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { mapAccountRow, type AccountRow } from './mappers/accountRowMapper';

export class SqlAccountRepository implements AccountRepository {
  public constructor(private readonly database: Database) {}

  public async getById(id: string, transaction?: Transaction): Promise<Account | null> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<AccountRow[]>`
      select id, name, type, created_at, updated_at
      from accounts
      where id = ${id}
    `;

    const row = rows[0];
    return row === undefined ? null : mapAccountRow(row);
  }

  public async insert(account: Account, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      insert into accounts (id, name, type, created_at, updated_at)
      values (${account.id}, ${account.name}, ${account.type}, ${account.createdAt}, ${account.updatedAt})
    `;
  }

  public async update(account: Account, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      update accounts
      set name = ${account.name},
          type = ${account.type},
          updated_at = ${account.updatedAt}
      where id = ${account.id}
    `;
  }
}
