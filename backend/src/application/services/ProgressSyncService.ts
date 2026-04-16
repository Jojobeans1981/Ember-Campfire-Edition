import type { ProgressOperation } from '../../domain/models';
import type {
  ProfileProgressRepository,
  ProgressOperationRepository
} from '../../domain/repositories';
import type { TransactionManager } from '../../shared/persistence';
import type { Clock } from '../../shared/time/Clock';

import { ConflictResolutionPolicy } from '../../domain/services';

import { XpDerivationService } from './XpDerivationService';

export interface ProgressSyncResult {
  startingVersion: number;
  endingVersion: number;
  applied: Array<{
    clientOperationId: string;
    appliedVersion: number;
  }>;
  rejected: Array<{
    clientOperationId: string;
    code: 'conflict' | 'invalid' | 'duplicate';
    message: string;
  }>;
  snapshot: Awaited<ReturnType<ProfileProgressRepository['getOrCreateForUpdate']>>;
}

const DUPLICATE_MESSAGE = 'Operation has already been processed.';

export class ProgressSyncService {
  public constructor(private readonly dependencies: {
    profileProgressRepository: ProfileProgressRepository;
    progressOperationRepository: ProgressOperationRepository;
    transactionManager: TransactionManager;
    xpDerivationService: XpDerivationService;
    clock: Clock;
  }) {}

  public async sync(profileId: string, operations: ProgressOperation[]): Promise<ProgressSyncResult> {
    return this.dependencies.transactionManager.withTransaction(async (transaction) => {
      const now = this.dependencies.clock.now();
      const snapshot = await this.dependencies.profileProgressRepository.getOrCreateForUpdate(profileId, now, transaction);
      const seenClientOperationIds = new Set<string>();
      const candidateOperations: ProgressOperation[] = [];
      const duplicateRejections: Array<ProgressSyncResult['rejected'][number] & { index: number }> = [];
      const operationByClientOperationId = new Map<string, ProgressOperation>();
      const operationIndexByClientOperationId = new Map<string, number>();

      for (const [index, operation] of operations.entries()) {
        const isDuplicateInBatch = seenClientOperationIds.has(operation.clientOperationId);
        const isDuplicateInStore = isDuplicateInBatch
          ? false
          : await this.dependencies.progressOperationRepository.hasClientOperation(
              profileId,
              operation.clientOperationId,
              transaction
            );

        if (isDuplicateInBatch || isDuplicateInStore) {
          duplicateRejections.push({
            index,
            clientOperationId: operation.clientOperationId,
            code: 'duplicate',
            message: DUPLICATE_MESSAGE
          });

          await this.dependencies.progressOperationRepository.recordRejected(
            {
              operation,
              code: 'duplicate',
              message: DUPLICATE_MESSAGE,
              receivedAt: now
            },
            transaction
          );

          continue;
        }

        seenClientOperationIds.add(operation.clientOperationId);
        candidateOperations.push(operation);
        operationByClientOperationId.set(operation.clientOperationId, operation);
        operationIndexByClientOperationId.set(operation.clientOperationId, index);
      }

      const result = ConflictResolutionPolicy.applyProgressOperations(snapshot, candidateOperations, now);
      const canonicalSnapshot = {
        ...result.snapshot,
        xp: this.dependencies.xpDerivationService.derive(result.snapshot.ufliProgress)
      };

      if (result.applied.length > 0) {
        await this.dependencies.profileProgressRepository.upsert(canonicalSnapshot, transaction);
      }

      for (const applied of result.applied) {
        await this.dependencies.progressOperationRepository.recordApplied(
          {
            operation: operationByClientOperationId.get(applied.clientOperationId)!,
            appliedSnapshotVersion: applied.appliedVersion,
            receivedAt: now
          },
          transaction
        );
      }

      for (const rejected of result.rejected) {
        await this.dependencies.progressOperationRepository.recordRejected(
          {
            operation: operationByClientOperationId.get(rejected.clientOperationId)!,
            code: rejected.code,
            message: rejected.message,
            receivedAt: now
          },
          transaction
        );
      }

      const orderedRejected = [
        ...duplicateRejections,
        ...result.rejected.map((rejected) => ({
          ...rejected,
          index: operationIndexByClientOperationId.get(rejected.clientOperationId) ?? Number.MAX_SAFE_INTEGER
        }))
      ]
        .sort((left, right) => left.index - right.index)
        .map(({ index: _index, ...rejected }) => rejected);

      return {
        startingVersion: result.startingVersion,
        endingVersion: result.endingVersion,
        applied: result.applied,
        rejected: orderedRejected,
        snapshot: canonicalSnapshot
      };
    });
  }
}
