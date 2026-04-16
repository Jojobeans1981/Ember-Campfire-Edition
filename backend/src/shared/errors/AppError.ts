import type { ErrorCode } from './ErrorCodes';
import { ERROR_CODES } from './ErrorCodes';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;

  public constructor(message: string, options?: { code?: ErrorCode; status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR;
    this.status = options?.status ?? 500;
  }
}
