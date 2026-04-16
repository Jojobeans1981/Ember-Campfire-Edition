import type {
  AppliedProgressOperationRecord,
  ProgressOperationRepository,
  RejectedProgressOperationRecord
} from '../../../domain/repositories';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { toJsonField } from './jsonFields';

interface CountRow {
  count: number;
}

export class SqlProgressOperationRepository implements ProgressOperationRepository {
  public constructor(private readonly database: Database) {}

  public async hasClientOperation(profileId: string, clientOperationId: string, transaction?: Transaction): Promise<boolean> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<CountRow[]>`
      select count(*)::int as count
      from progress_operations
      where profile_id = ${profileId}
        and client_operation_id = ${clientOperationId}
    `;

    return rows[0]?.count === 1;
  }

  public async recordApplied(record: AppliedProgressOperationRecord, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);
    const { operation } = record;

    await executor`
      insert into progress_operations (
        id,
        profile_id,
        client_operation_id,
        base_version,
        operation_type,
        payload,
        status,
        applied_snapshot_version,
        error_code,
        error_message,
        received_at
      )
      values (
        ${crypto.randomUUID()},
        ${operation.profileId},
        ${operation.clientOperationId},
        ${operation.baseVersion},
        ${operation.type},
        ${toJsonField(executor, operation.payload)},
        'applied',
        ${record.appliedSnapshotVersion},
        ${null},
        ${null},
        ${record.receivedAt}
      )
      on conflict (profile_id, client_operation_id) do nothing
    `;
  }

  public async recordRejected(record: RejectedProgressOperationRecord, transaction?: Transaction): Promise<void> {
    const executor = resolveDbExecutor(this.database, transaction);
    const { operation } = record;

    await executor`
      insert into progress_operations (
        id,
        profile_id,
        client_operation_id,
        base_version,
        operation_type,
        payload,
        status,
        applied_snapshot_version,
        error_code,
        error_message,
        received_at
      )
      values (
        ${crypto.randomUUID()},
        ${operation.profileId},
        ${operation.clientOperationId},
        ${operation.baseVersion},
        ${operation.type},
        ${toJsonField(executor, operation.payload)},
        'rejected',
        ${null},
        ${record.code},
        ${record.message},
        ${record.receivedAt}
      )
      on conflict (profile_id, client_operation_id) do nothing
    `;
  }
}
