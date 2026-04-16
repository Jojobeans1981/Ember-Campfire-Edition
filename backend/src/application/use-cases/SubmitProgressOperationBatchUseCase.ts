import type { CurrentUserContext } from '../CurrentUserContext';
import type {
  ProgressOperationBatchRequestDto,
  ProgressOperationBatchResponseDto
} from '../dto/ProgressOperationBatchDto';

import { mapProfileProgressToDto } from '../dto/ProfileProgressDto';
import { ProfileAccessService, ProgressSyncService } from '../services';

export class SubmitProgressOperationBatchUseCase {
  public constructor(private readonly dependencies: {
    profileAccessService: ProfileAccessService;
    progressSyncService: ProgressSyncService;
  }) {}

  public async execute(
    currentUser: CurrentUserContext,
    input: ProgressOperationBatchRequestDto
  ): Promise<ProgressOperationBatchResponseDto> {
    await this.dependencies.profileAccessService.getProfileForCurrentUser(input.profileId, currentUser);

    const result = await this.dependencies.progressSyncService.sync(
      input.profileId,
      input.operations.map((operation) => {
        switch (operation.type) {
          case 'complete_lesson':
            return {
              profileId: input.profileId,
              clientOperationId: operation.clientOperationId,
              baseVersion: input.baseVersion,
              type: operation.type,
              payload: operation.payload,
              createdAt: operation.createdAt
            };
          case 'complete_activity':
            return {
              profileId: input.profileId,
              clientOperationId: operation.clientOperationId,
              baseVersion: input.baseVersion,
              type: operation.type,
              payload: operation.payload,
              createdAt: operation.createdAt
            };
          case 'complete_connected_text':
            return {
              profileId: input.profileId,
              clientOperationId: operation.clientOperationId,
              baseVersion: input.baseVersion,
              type: operation.type,
              payload: operation.payload,
              createdAt: operation.createdAt
            };
          case 'set_selected_friend':
            return {
              profileId: input.profileId,
              clientOperationId: operation.clientOperationId,
              baseVersion: input.baseVersion,
              type: operation.type,
              payload: operation.payload,
              createdAt: operation.createdAt
            };
          case 'replace_skill_state':
            return {
              profileId: input.profileId,
              clientOperationId: operation.clientOperationId,
              baseVersion: input.baseVersion,
              type: operation.type,
              payload: operation.payload,
              createdAt: operation.createdAt
            };
        }
      })
    );

    return {
      profileId: input.profileId,
      startingVersion: result.startingVersion,
      endingVersion: result.endingVersion,
      applied: result.applied,
      rejected: result.rejected,
      snapshot: mapProfileProgressToDto(result.snapshot)
    };
  }
}
