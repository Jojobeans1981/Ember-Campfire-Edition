import { describe, expect, test } from 'bun:test';

import { DevAuthProvider } from '../../src/infrastructure/auth';

describe('DevAuthProvider', () => {
  const provider = new DevAuthProvider({
    env: 'development',
    users: [
      {
        key: 'owner',
        subject: 'dev-owner',
        email: 'owner@dev.local',
        displayName: 'Dev Owner',
        accountName: 'Dev Household',
        role: 'owner'
      }
    ]
  });

  test('resolves a known dev bearer token to normalized identity', async () => {
    const identity = await provider.authenticate({
      headers: new Headers({ authorization: 'Bearer dev:owner' })
    });

    expect(identity).toEqual({
      provider: 'dev',
      subject: 'dev-owner',
      email: 'owner@dev.local',
      displayName: 'Dev Owner'
    });
  });

  test('rejects unknown dev bearer tokens', async () => {
    const identity = await provider.authenticate({
      headers: new Headers({ authorization: 'Bearer dev:missing' })
    });

    expect(identity).toBeNull();
  });
});
