import type { ProfileProgressRepository } from '../../domain/repositories';
import type { CurrentUserContext } from '../CurrentUserContext';
import type {
  ProgressSnapshotRequestDto,
  ProgressSnapshotResponseDto
} from '../dto/ProgressSnapshotDto';
import type { TransactionManager } from '../../shared/persistence';
import type { Clock } from '../../shared/time/Clock';

import { mapProfileProgressToDto } from '../dto/ProfileProgressDto';
import { ProfileAccessService, XpDerivationService } from '../services';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';

export class SubmitProgressSnapshotUseCase {
  public constructor(private readonly dependencies: {
    profileAccessService: ProfileAccessService;
    profileProgressRepository: ProfileProgressRepository;
    transactionManager: TransactionManager;
    xpDerivationService: XpDerivationService;
    clock: Clock;
  }) {}

  public async execute(
    currentUser: CurrentUserContext,
    input: ProgressSnapshotRequestDto
  ): Promise<ProgressSnapshotResponseDto> {
    await this.dependencies.profileAccessService.getProfileForCurrentUser(input.profileId, currentUser);

    const snapshot = await this.dependencies.transactionManager.withTransaction(async (transaction) => {
      const now = this.dependencies.clock.now();
      const existing = await this.dependencies.profileProgressRepository.getOrCreateForUpdate(
        input.profileId,
        now,
        transaction
      );

      if (input.version !== existing.version) {
        throw new AppError('Progress snapshot is stale against the current server version.', {
          code: ERROR_CODES.CONFLICT,
          status: 409
        });
      }

      const canonicalSnapshot = {
        profileId: input.profileId,
        version: existing.version + 1,
        ufliProgress: input.ufliProgress,
        xp: this.dependencies.xpDerivationService.derive(input.ufliProgress),
        selectedFriend: input.selectedFriend,
        skillState: input.skillState,
        skillStateSchemaVersion: input.skillStateSchemaVersion,
        updatedAt: now
      };

      await this.dependencies.profileProgressRepository.upsert(canonicalSnapshot, transaction);
      return canonicalSnapshot;
    });

    return mapProfileProgressToDto(snapshot);
  }
}
