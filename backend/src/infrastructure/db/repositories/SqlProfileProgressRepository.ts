import type { ProfileProgress } from '../../../domain/models/ProfileProgress';
import type { ProfileProgressRepository } from '../../../domain/repositories';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { toJsonField, toNullableJsonField } from './jsonFields';
import { mapProfileProgressRow, type ProfileProgressRow } from './mappers/profileProgressRowMapper';
import { createEmptyProfileProgress } from '../../../domain/models/ProfileProgress';

export class SqlProfileProgressRepository implements ProfileProgressRepository {
  public constructor(private readonly database: Database) {}

  public async getByProfileId(profileId: string, transaction?: Transaction): Promise<ProfileProgress | null> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<ProfileProgressRow[]>`
      select profile_id, version, ufli_progress, xp, selected_friend, skill_state, skill_state_schema_version, updated_at
      from profile_progress
      where profile_id = ${profileId}
    `;

    const row = rows[0];
    return row === undefined ? null : mapProfileProgressRow(row);
  }

  public async getOrCreateForUpdate(profileId: string, updatedAt: Date, transaction: Transaction): Promise<ProfileProgress> {
    const executor = resolveDbExecutor(this.database, transaction);
    const emptyProgress = createEmptyProfileProgress(profileId, updatedAt);

    await executor`
      insert into profile_progress (
        profile_id,
        version,
        ufli_progress,
        xp,
        selected_friend,
        skill_state,
        skill_state_schema_version,
        updated_at
      )
      values (
        ${emptyProgress.profileId},
        ${emptyProgress.version},
        ${toJsonField(executor, emptyProgress.ufliProgress)},
        ${emptyProgress.xp},
        ${toNullableJsonField(executor, emptyProgress.selectedFriend)},
        ${toJsonField(executor, emptyProgress.skillState)},
        ${emptyProgress.skillStateSchemaVersion},
        ${emptyProgress.updatedAt}
      )
      on conflict (profile_id) do nothing
    `;

    const rows = await executor<ProfileProgressRow[]>`
      select profile_id, version, ufli_progress, xp, selected_friend, skill_state, skill_state_schema_version, updated_at
      from profile_progress
      where profile_id = ${profileId}
      for update
    `;

    return mapProfileProgressRow(rows[0]!);
  }

  public async upsert(progress: ProfileProgress, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);

    await executor`
      insert into profile_progress (
        profile_id,
        version,
        ufli_progress,
        xp,
        selected_friend,
        skill_state,
        skill_state_schema_version,
        updated_at
      )
      values (
        ${progress.profileId},
        ${progress.version},
        ${toJsonField(executor, progress.ufliProgress)},
        ${progress.xp},
        ${toNullableJsonField(executor, progress.selectedFriend)},
        ${toJsonField(executor, progress.skillState)},
        ${progress.skillStateSchemaVersion},
        ${progress.updatedAt}
      )
      on conflict (profile_id) do update
      set version = excluded.version,
          ufli_progress = excluded.ufli_progress,
          xp = excluded.xp,
          selected_friend = excluded.selected_friend,
          skill_state = excluded.skill_state,
          skill_state_schema_version = excluded.skill_state_schema_version,
          updated_at = excluded.updated_at
    `;
  }
}
