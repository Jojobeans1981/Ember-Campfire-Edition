import type { Profile } from '../../domain/models/Profile';
import type { ProfileRepository } from '../../domain/repositories';

import type { CurrentUserContext } from '../CurrentUserContext';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';

export class ProfileAccessService {
  public constructor(private readonly profileRepository: ProfileRepository) {}

  public async getProfileForCurrentUser(profileId: string, currentUser: CurrentUserContext): Promise<Profile> {
    const profile = await this.profileRepository.getById(profileId);

    if (profile === null || profile.accountId !== currentUser.accountId) {
      throw new AppError('Profile not found', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404
      });
    }

    return profile;
  }
}
