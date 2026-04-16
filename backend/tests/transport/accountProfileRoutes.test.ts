import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';

import { createTestHarness } from '../fixtures/backendTestHarness';

describe('account and profile routes', () => {
  let harness!: Awaited<ReturnType<typeof createTestHarness>>;
  let hasHarness = false;

  const readJson = async <T>(response: Response): Promise<T> => response.json() as Promise<T>;

  beforeAll(async () => {
    harness = await createTestHarness();
    hasHarness = true;
  });

  beforeEach(async () => {
    if (hasHarness) {
      await harness.truncateAll();
    }
  });

  afterAll(async () => {
    if (hasHarness) {
      await harness.close();
    }
  });

  test('returns 401 for unauthenticated requests', async () => {
    const response = await harness.server.handle(new Request('http://test/me'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required'
      }
    });
  });

  test('returns 401 for unknown dev bearer tokens', async () => {
    const response = await harness.server.handle(
      new Request('http://test/me', {
        headers: {
          authorization: 'Bearer dev:missing'
        }
      })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication required'
      }
    });
  });

  test('supports /me, /account, /profiles, and POST /profiles with dev bearer auth', async () => {
    const authorization = { authorization: 'Bearer dev:owner' };

    const meResponse = await harness.server.handle(new Request('http://test/me', { headers: authorization }));
    expect(meResponse.status).toBe(200);
    const me = await readJson<{ accountId: string; email: string; displayName: string; role: string }>(meResponse);
    expect(me).toMatchObject({
      email: 'owner@dev.local',
      displayName: 'Dev Owner',
      role: 'owner'
    });

    const accountResponse = await harness.server.handle(
      new Request('http://test/account', { headers: authorization })
    );
    expect(accountResponse.status).toBe(200);
    const account = await readJson<{ id: string; name: string; type: string }>(accountResponse);
    expect(account).toMatchObject({
      id: me.accountId,
      name: 'Dev Household',
      type: 'family'
    });

    const emptyProfilesResponse = await harness.server.handle(
      new Request('http://test/profiles', { headers: authorization })
    );
    expect(emptyProfilesResponse.status).toBe(200);
    expect(await emptyProfilesResponse.json()).toEqual([]);

    const createResponse = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          ...authorization,
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'Ember' })
      })
    );
    expect(createResponse.status).toBe(201);
    const createdProfile = await readJson<{ accountId: string; name: string }>(createResponse);
    expect(createdProfile).toMatchObject({
      accountId: me.accountId,
      name: 'Ember'
    });

    const profilesResponse = await harness.server.handle(
      new Request('http://test/profiles', { headers: authorization })
    );
    expect(profilesResponse.status).toBe(200);
    expect(await profilesResponse.json()).toEqual([createdProfile]);
  });

  test('validates profile creation payloads', async () => {
    const response = await harness.server.handle(
      new Request('http://test/profiles', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev:owner',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: '   ' })
      })
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: 'validation_error',
        message: 'name is required'
      }
    });
  });
});
