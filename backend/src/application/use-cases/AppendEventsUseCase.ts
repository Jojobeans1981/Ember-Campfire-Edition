import type { CurrentUserContext } from '../CurrentUserContext';
import type { EventBatchRequestDto, EventBatchResponseDto } from '../dto/EventBatchDto';

import { AppendOnlyEventService, ProfileAccessService } from '../services';

export class AppendEventsUseCase {
  public constructor(private readonly dependencies: {
    profileAccessService: ProfileAccessService;
    appendOnlyEventService: AppendOnlyEventService;
  }) {}

  public async execute(
    currentUser: CurrentUserContext,
    input: EventBatchRequestDto
  ): Promise<EventBatchResponseDto> {
    await this.dependencies.profileAccessService.getProfileForCurrentUser(input.profileId, currentUser);

    return this.dependencies.appendOnlyEventService.append(input.profileId, input.events);
  }
}
