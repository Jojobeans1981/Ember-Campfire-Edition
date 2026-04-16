import type { ProfileProgressRepository } from '../../domain/repositories';
import type { Clock } from '../../shared/time/Clock';

import type { CurrentUserContext } from '../CurrentUserContext';
import { createEmptyProfileProgress } from '../../domain/models';
import { mapProfileProgressToDto, type ProfileProgressDto } from '../dto/ProfileProgressDto';
import { ProfileAccessService } from '../services';

export class GetProfileProgressUseCase {
  public constructor(private readonly dependencies: {
    profileAccessService: ProfileAccessService;
    profileProgressRepository: ProfileProgressRepository;
    clock: Clock;
  }) {}

  public async execute(currentUser: CurrentUserContext, profileId: string): Promise<ProfileProgressDto> {
    const profile = await this.dependencies.profileAccessService.getProfileForCurrentUser(profileId, currentUser);
    const progress = await this.dependencies.profileProgressRepository.getByProfileId(profile.id);

    return mapProfileProgressToDto(
      progress ?? createEmptyProfileProgress(profile.id, this.dependencies.clock.now())
    );
  }
}
