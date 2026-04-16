import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/ErrorCodes';

export const assertNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string') {
    throw createValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw createValidationError(`${fieldName} is required`);
  }

  return trimmed;
};

export const assertMaxLength = (value: string, fieldName: string, maxLength: number): string => {
  if (value.length > maxLength) {
    throw createValidationError(`${fieldName} must be at most ${maxLength} characters`);
  }

  return value;
};

export const assertInteger = (value: unknown, fieldName: string, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw createValidationError(`${fieldName} must be an integer greater than or equal to ${minimum}`);
  }

  return value;
};

export const assertBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw createValidationError(`${fieldName} must be a boolean`);
  }

  return value;
};

export const assertObject = (value: unknown, fieldName: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw createValidationError(`${fieldName} must be an object`);
  }

  return value as Record<string, unknown>;
};

export const assertArray = (value: unknown, fieldName: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw createValidationError(`${fieldName} must be an array`);
  }

  return value;
};

export const assertIsoDateString = (value: unknown, fieldName: string): Date => {
  if (typeof value !== 'string') {
    throw createValidationError(`${fieldName} must be a string`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createValidationError(`${fieldName} must be a valid ISO-8601 datetime`);
  }

  return date;
};

export const assertUuidString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw createValidationError(`${fieldName} must be a valid UUID`);
  }

  return value;
};

export const parseJsonObjectBody = async (request: Request): Promise<Record<string, unknown>> => {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw createValidationError('Request body must be valid JSON');
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw createValidationError('Request body must be an object');
  }

  return payload as Record<string, unknown>;
};

const createValidationError = (message: string): AppError => {
  return new AppError(message, {
    code: ERROR_CODES.VALIDATION_ERROR,
    status: 422
  });
};
