import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { CognitoAuthProvider } from '../../src/infrastructure/auth';

interface TestJwk {
  n?: string;
  e?: string;
}

const region = 'us-east-2';
const userPoolId = 'us-east-2_example';
const clientId = 'client-123';
const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
let fetchCalls = 0;

describe('CognitoAuthProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchCalls = 0;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('authenticates a valid Cognito id token', async () => {
    const keyPair = await generateSigningKeyPair();
    const provider = createProvider([createJwk('kid-1', keyPair.publicJwk)]);

    const token = await createSignedToken({
      keyPair,
      kid: 'kid-1',
      payload: {
        iss: issuer,
        sub: 'subject-1',
        aud: clientId,
        token_use: 'id',
        exp: futureEpochSeconds(),
        email: 'reader@example.com',
        name: 'Reader One'
      }
    });

    await expect(authenticate(provider, token)).resolves.toEqual({
      provider: 'cognito',
      subject: 'subject-1',
      email: 'reader@example.com',
      displayName: 'Reader One'
    });
    expect(fetchCalls).toBe(1);
  });

  test('rejects malformed JWTs before JWKS lookup', async () => {
    const provider = createProvider([]);

    await expect(authenticate(provider, 'not-a-jwt')).resolves.toBeNull();
    expect(fetchCalls).toBe(0);
  });

  test('rejects wrong issuer, expired tokens, wrong token_use, wrong audience, and bad signatures', async () => {
    const keyPair = await generateSigningKeyPair();
    const otherKeyPair = await generateSigningKeyPair();
    const provider = createProvider([createJwk('kid-1', keyPair.publicJwk)]);

    const scenarios = [
      createSignedToken({
        keyPair,
        kid: 'kid-1',
        payload: { iss: 'https://wrong-issuer', sub: 'subject-1', aud: clientId, token_use: 'id', exp: futureEpochSeconds() }
      }),
      createSignedToken({
        keyPair,
        kid: 'kid-1',
        payload: { iss: issuer, sub: 'subject-1', aud: clientId, token_use: 'id', exp: pastEpochSeconds() }
      }),
      createSignedToken({
        keyPair,
        kid: 'kid-1',
        payload: { iss: issuer, sub: 'subject-1', aud: clientId, token_use: 'access', exp: futureEpochSeconds() }
      }),
      createSignedToken({
        keyPair,
        kid: 'kid-1',
        payload: { iss: issuer, sub: 'subject-1', aud: 'wrong-client', token_use: 'id', exp: futureEpochSeconds() }
      }),
      createSignedToken({
        keyPair: otherKeyPair,
        kid: 'kid-1',
        payload: { iss: issuer, sub: 'subject-1', aud: clientId, token_use: 'id', exp: futureEpochSeconds() }
      })
    ];

    for (const tokenPromise of scenarios) {
      await expect(authenticate(provider, await tokenPromise)).resolves.toBeNull();
    }
  });

  test('re-fetches JWKS once when the cached key set does not include the presented kid', async () => {
    const firstKeyPair = await generateSigningKeyPair();
    const secondKeyPair = await generateSigningKeyPair();
    const jwksResponses = [
      [createJwk('kid-1', firstKeyPair.publicJwk)],
      [createJwk('kid-2', secondKeyPair.publicJwk)]
    ];

    globalThis.fetch = (async () => {
      const keys = jwksResponses[Math.min(fetchCalls, jwksResponses.length - 1)];
      fetchCalls += 1;
      return new Response(JSON.stringify({ keys }), { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new CognitoAuthProvider({
      userPoolId,
      clientId,
      region,
      domain: null
    });

    const token = await createSignedToken({
      keyPair: secondKeyPair,
      kid: 'kid-2',
      payload: {
        iss: issuer,
        sub: 'subject-2',
        aud: clientId,
        token_use: 'id',
        exp: futureEpochSeconds(),
        'cognito:username': 'reader-two'
      }
    });

    await expect(authenticate(provider, token)).resolves.toEqual({
      provider: 'cognito',
      subject: 'subject-2',
      email: null,
      displayName: 'reader-two'
    });
    expect(fetchCalls).toBe(2);
  });
});

const createProvider = (keys: Array<Record<string, string>>) => {
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ keys }), { status: 200 });
  }) as unknown as typeof fetch;

  return new CognitoAuthProvider({
    userPoolId,
    clientId,
    region,
    domain: null
  });
};

const authenticate = (provider: CognitoAuthProvider, token: string) => {
  return provider.authenticate({
    headers: new Headers({
      authorization: `Bearer ${token}`
    })
  });
};

const futureEpochSeconds = () => Math.floor(Date.now() / 1000) + 3600;
const pastEpochSeconds = () => Math.floor(Date.now() / 1000) - 3600;

const createJwk = (kid: string, jwk: TestJwk) => ({
  kid,
  kty: 'RSA',
  alg: 'RS256',
  use: 'sig',
  n: String(jwk.n),
  e: String(jwk.e)
});

const generateSigningKeyPair = async () => {
  const cryptoKeyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  );

  return {
    privateKey: cryptoKeyPair.privateKey,
    publicJwk: await crypto.subtle.exportKey('jwk', cryptoKeyPair.publicKey)
  };
};

const createSignedToken = async (options: {
  keyPair: Awaited<ReturnType<typeof generateSigningKeyPair>>;
  kid: string;
  payload: Record<string, unknown>;
}) => {
  const encodedHeader = encodeBase64Url({ alg: 'RS256', typ: 'JWT', kid: options.kid });
  const encodedPayload = encodeBase64Url(options.payload);
  const data = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, options.keyPair.privateKey, data);

  return `${encodedHeader}.${encodedPayload}.${encodeBytesBase64Url(new Uint8Array(signature))}`;
};

const encodeBase64Url = (value: unknown) => {
  return encodeBytesBase64Url(new TextEncoder().encode(JSON.stringify(value)));
};

const encodeBytesBase64Url = (bytes: Uint8Array) => {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};
