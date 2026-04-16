export const ERROR_CODES = {
  INTERNAL_ERROR: 'internal_error',
  NOT_FOUND: 'not_found',
  UNAUTHORIZED: 'unauthorized',
  VALIDATION_ERROR: 'validation_error',
  CONFLICT: 'conflict'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
