import type { ProfileRepository } from '../../domain/repositories';

import type { CurrentUserContext } from '../CurrentUserContext';
import type { ProfileDto } from '../dto/ProfileDto';

export class ListProfilesUseCase {
  public constructor(private readonly profileRepository: ProfileRepository) {}

  public async execute(currentUser: CurrentUserContext): Promise<ProfileDto[]> {
    const profiles = await this.profileRepository.listByAccountId(currentUser.accountId);

    return profiles.map((profile) => ({
      id: profile.id,
      accountId: profile.accountId,
      name: profile.name,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    }));
  }
}
