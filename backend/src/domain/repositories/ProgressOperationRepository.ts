import type { ProgressOperation, ProgressOperationRejectionCode } from '../models/ProgressOperation';
import type { ProfileId } from '../value-objects/ProfileId';
import type { Transaction } from '../../shared/persistence';

export interface AppliedProgressOperationRecord {
  operation: ProgressOperation;
  appliedSnapshotVersion: number;
  receivedAt: Date;
}

export interface RejectedProgressOperationRecord {
  operation: ProgressOperation;
  code: ProgressOperationRejectionCode;
  message: string;
  receivedAt: Date;
}

export interface ProgressOperationRepository {
  hasClientOperation(profileId: ProfileId, clientOperationId: string, transaction?: Transaction): Promise<boolean>;
  recordApplied(record: AppliedProgressOperationRecord, transaction?: Transaction): Promise<void>;
  recordRejected(record: RejectedProgressOperationRecord, transaction?: Transaction): Promise<void>;
}
