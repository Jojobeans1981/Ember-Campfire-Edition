import type { UserRepository } from '../../domain/repositories';

import type { CurrentUserContext } from '../CurrentUserContext';
import type { MeDto } from '../dto/MeDto';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';

export class GetCurrentUserUseCase {
  public constructor(private readonly userRepository: UserRepository) {}

  public async execute(currentUser: CurrentUserContext): Promise<MeDto> {
    const user = await this.userRepository.getById(currentUser.userId);

    if (user === null || user.accountId !== currentUser.accountId) {
      throw new AppError('Current user was not found', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404
      });
    }

    return {
      id: user.id,
      accountId: user.accountId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      authProvider: user.authProvider,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }
}
