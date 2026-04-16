import type { ErrorCode } from '../../../shared/errors/ErrorCodes';

export const presentError = (status: number, code: ErrorCode, message: string): Response =>
  Response.json(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
