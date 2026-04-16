import type { ProgressOperation, ProgressOperationRejectionCode } from '../../../../domain/models/ProgressOperation';

import { fromJsonField } from '../jsonFields';

export type ProgressOperationStatus = 'applied' | 'rejected';

export interface ProgressOperationRow {
  id: string;
  profile_id: string;
  client_operation_id: string;
  base_version: number;
  operation_type: ProgressOperation['type'];
  payload: unknown;
  status: ProgressOperationStatus;
  applied_snapshot_version: number | null;
  error_code: ProgressOperationRejectionCode | null;
  error_message: string | null;
  received_at: Date;
}

export interface MappedProgressOperationRow {
  operation: ProgressOperation;
  status: ProgressOperationStatus;
  appliedSnapshotVersion: number | null;
  errorCode: ProgressOperationRejectionCode | null;
  errorMessage: string | null;
  receivedAt: Date;
}

export const mapProgressOperationRow = (row: ProgressOperationRow): MappedProgressOperationRow => ({
  operation: {
    profileId: row.profile_id,
    clientOperationId: row.client_operation_id,
    baseVersion: row.base_version,
    type: row.operation_type,
    payload: fromJsonField<ProgressOperation['payload']>(row.payload),
    createdAt: row.received_at
  } as ProgressOperation,
  status: row.status,
  appliedSnapshotVersion: row.applied_snapshot_version,
  errorCode: row.error_code,
  errorMessage: row.error_message,
  receivedAt: row.received_at
});
