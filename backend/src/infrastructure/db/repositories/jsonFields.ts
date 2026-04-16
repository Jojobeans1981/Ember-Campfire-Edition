import type { DbExecutor } from './DbExecutor';

export const fromJsonField = <T>(value: unknown): T => {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
};

export const fromNullableJsonField = <T>(value: unknown | null): T | null => {
  return value === null ? null : fromJsonField<T>(value);
};

export const toJsonField = <T>(executor: DbExecutor, value: T) => {
  return executor.json(value as never);
};

export const toNullableJsonField = <T>(executor: DbExecutor, value: T | null) => {
  return value === null ? null : executor.json(value as never);
};

export const mapJsonField = fromJsonField;
