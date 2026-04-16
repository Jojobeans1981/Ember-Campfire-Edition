import type { Profile } from '../../../domain/models/Profile';
import type { ProfileRepository } from '../../../domain/repositories';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { mapProfileRow, type ProfileRow } from './mappers/profileRowMapper';

export class SqlProfileRepository implements ProfileRepository {
  public constructor(private readonly database: Database) {}

  public async getById(id: string, transaction?: Transaction): Promise<Profile | null> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<ProfileRow[]>`
      select id, account_id, name, created_at, updated_at
      from profiles
      where id = ${id}
    `;

    const row = rows[0];
    return row === undefined ? null : mapProfileRow(row);
  }

  public async listByAccountId(accountId: string, transaction?: Transaction): Promise<Profile[]> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<ProfileRow[]>`
      select id, account_id, name, created_at, updated_at
      from profiles
      where account_id = ${accountId}
      order by created_at asc, id asc
    `;

    return rows.map(mapProfileRow);
  }

  public async insert(profile: Profile, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      insert into profiles (id, account_id, name, created_at, updated_at)
      values (${profile.id}, ${profile.accountId}, ${profile.name}, ${profile.createdAt}, ${profile.updatedAt})
    `;
  }

  public async update(profile: Profile, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      update profiles
      set account_id = ${profile.accountId},
          name = ${profile.name},
          updated_at = ${profile.updatedAt}
      where id = ${profile.id}
    `;
  }
}
