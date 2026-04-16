import type { AccountRepository } from '../../domain/repositories';

import type { CurrentUserContext } from '../CurrentUserContext';
import type { AccountDto } from '../dto/AccountDto';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';

export class GetAccountUseCase {
  public constructor(private readonly accountRepository: AccountRepository) {}

  public async execute(currentUser: CurrentUserContext): Promise<AccountDto> {
    const account = await this.accountRepository.getById(currentUser.accountId);

    if (account === null) {
      throw new AppError('Account not found', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404
      });
    }

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }
}
