import { describe, expect, test } from 'bun:test';

import { withErrorHandling } from '../../src/transport/http/middleware/errorMiddleware';

describe('error middleware', () => {
  test('maps unique constraint failures to conflict responses', async () => {
    const response = await withErrorHandling(async () => {
      throw {
        code: '23505',
        message: 'duplicate key value violates unique constraint'
      };
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: 'conflict',
        message: 'Resource already exists.'
      }
    });
  });

  test('maps constraint validation failures to validation errors', async () => {
    const response = await withErrorHandling(async () => {
      throw {
        code: '23503',
        message: 'insert or update on table violates foreign key constraint'
      };
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'Request violates database constraints.'
      }
    });
  });
});
