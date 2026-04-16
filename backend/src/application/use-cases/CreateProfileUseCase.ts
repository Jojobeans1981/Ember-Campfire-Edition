import type { ProfileRepository } from '../../domain/repositories';
import type { Clock } from '../../shared/time/Clock';
import type { IdGenerator } from '../../shared/ids/IdGenerator';

import type { CurrentUserContext } from '../CurrentUserContext';
import type { ProfileDto } from '../dto/ProfileDto';

export interface CreateProfileInput {
  name: string;
}

export class CreateProfileUseCase {
  public constructor(private readonly dependencies: {
    profileRepository: ProfileRepository;
    idGenerator: IdGenerator;
    clock: Clock;
  }) {}

  public async execute(currentUser: CurrentUserContext, input: CreateProfileInput): Promise<ProfileDto> {
    const now = this.dependencies.clock.now();
    const profile = {
      id: this.dependencies.idGenerator.generate(),
      accountId: currentUser.accountId,
      name: input.name,
      createdAt: now,
      updatedAt: now
    };

    await this.dependencies.profileRepository.insert(profile);

    return {
      id: profile.id,
      accountId: profile.accountId,
      name: profile.name,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString()
    };
  }
}
