import type { User } from '../../../domain/models/User';
import type { UserRepository } from '../../../domain/repositories';
import type { AuthProviderType } from '../../../domain/types/AuthProviderType';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { mapUserRow, type UserRow } from './mappers/userRowMapper';

export class SqlUserRepository implements UserRepository {
  public constructor(private readonly database: Database) {}

  public async getById(id: string, transaction?: Transaction): Promise<User | null> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<UserRow[]>`
      select id, account_id, email, display_name, role, auth_provider, auth_subject, created_at, updated_at
      from users
      where id = ${id}
    `;

    const row = rows[0];
    return row === undefined ? null : mapUserRow(row);
  }

  public async getByAuthIdentity(
    authProvider: AuthProviderType,
    authSubject: string,
    transaction?: Transaction
  ): Promise<User | null> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<UserRow[]>`
      select id, account_id, email, display_name, role, auth_provider, auth_subject, created_at, updated_at
      from users
      where auth_provider = ${authProvider}
        and auth_subject = ${authSubject}
    `;

    const row = rows[0];
    return row === undefined ? null : mapUserRow(row);
  }

  public async listByAccountId(accountId: string, transaction?: Transaction): Promise<User[]> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<UserRow[]>`
      select id, account_id, email, display_name, role, auth_provider, auth_subject, created_at, updated_at
      from users
      where account_id = ${accountId}
      order by created_at asc, id asc
    `;

    return rows.map(mapUserRow);
  }

  public async insert(user: User, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      insert into users (
        id,
        account_id,
        email,
        display_name,
        role,
        auth_provider,
        auth_subject,
        created_at,
        updated_at
      )
      values (
        ${user.id},
        ${user.accountId},
        ${user.email},
        ${user.displayName},
        ${user.role},
        ${user.authProvider},
        ${user.authSubject},
        ${user.createdAt},
        ${user.updatedAt}
      )
    `;
  }

  public async update(user: User, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      update users
      set account_id = ${user.accountId},
          email = ${user.email},
          display_name = ${user.displayName},
          role = ${user.role},
          auth_provider = ${user.authProvider},
          auth_subject = ${user.authSubject},
          updated_at = ${user.updatedAt}
      where id = ${user.id}
    `;
  }
}
