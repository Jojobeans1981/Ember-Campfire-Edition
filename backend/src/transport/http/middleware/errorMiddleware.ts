import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/ErrorCodes';
import { presentError } from '../presenters/errorPresenter';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const POSTGRES_CONSTRAINT_VALIDATION_CODES = new Set(['23502', '23503', '23514', '22P02']);

function mapDatabaseError(error: unknown): AppError | null {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;

  if (code === POSTGRES_UNIQUE_VIOLATION) {
    return new AppError('Resource already exists.', {
      code: ERROR_CODES.CONFLICT,
      status: 409,
      cause: error,
    });
  }

  if (code && POSTGRES_CONSTRAINT_VALIDATION_CODES.has(code)) {
    return new AppError('Request violates database constraints.', {
      code: ERROR_CODES.VALIDATION_ERROR,
      status: 422,
      cause: error,
    });
  }

  return null;
}

export const withErrorHandling = async (handler: () => Response | Promise<Response>): Promise<Response> => {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return presentError(error.status, error.code, error.message);
    }

    const databaseError = mapDatabaseError(error);
    if (databaseError) {
      return presentError(databaseError.status, databaseError.code, databaseError.message);
    }

    return presentError(500, ERROR_CODES.INTERNAL_ERROR, 'Internal server error');
  }
};
