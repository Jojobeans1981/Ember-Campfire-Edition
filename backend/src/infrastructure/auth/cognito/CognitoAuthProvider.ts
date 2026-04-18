import type { AuthIdentity } from '../../../domain/models/AuthIdentity';
import type { CognitoAuthConfig } from '../../config/env';
import type { AuthProvider, RequestAuthContext } from '../AuthProvider';

interface JwtHeader {
  alg?: string;
  kid?: string;
}

interface JwtPayload {
  aud?: string;
  'cognito:username'?: string;
  email?: string;
  exp?: number;
  iss?: string;
  name?: string;
  sub?: string;
  token_use?: string;
}

interface JwkKey {
  alg?: string;
  e?: string;
  kid?: string;
  kty?: string;
  n?: string;
  use?: string;
}

interface JwksDocument {
  keys?: JwkKey[];
}

const JWKS_TTL_MS = 60 * 60 * 1000;
const JWKS_FORCE_REFRESH_COOLDOWN_MS = 30 * 1000;

export class CognitoAuthProvider implements AuthProvider {
  private readonly issuer: string;
  private readonly jwksUrl: string;
  private jwksCache: { expiresAt: number; keys: Map<string, JwkKey> } | null = null;
  private inFlightJwksPromise: Promise<Map<string, JwkKey>> | null = null;
  private lastRefreshAt: number | null = null;

  public constructor(private readonly config: CognitoAuthConfig) {
    this.issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
    this.jwksUrl = `${this.issuer}/.well-known/jwks.json`;
  }

  public async authenticate(request: RequestAuthContext): Promise<AuthIdentity | null> {
    const token = extractBearerToken(request.headers.get('authorization'));

    if (token === null) {
      return null;
    }

    const parsedToken = parseJwt(token);

    if (parsedToken === null || parsedToken.header.alg !== 'RS256' || !parsedToken.header.kid) {
      return null;
    }

    try {
      const jwk = await this.getSigningKey(parsedToken.header.kid);

      if (jwk === null || !isUsableRsaSigningKey(jwk, parsedToken.header.kid)) {
        return null;
      }

      const signatureValid = await verifyJwtSignature(token, jwk);

      if (!signatureValid) {
        return null;
      }
    } catch (error) {
      console.error(
        'CognitoAuthProvider.authenticate: jwks/getSigningKey/verifyJwtSignature failure, returning null.',
        error
      );
      return null;
    }

    if (parsedToken.payload.iss !== this.issuer) {
      return null;
    }

    if (parsedToken.payload.token_use !== 'id') {
      return null;
    }

    if (parsedToken.payload.aud !== this.config.clientId) {
      return null;
    }

    if (!parsedToken.payload.sub || isTokenExpired(parsedToken.payload.exp)) {
      return null;
    }

    return {
      provider: 'cognito',
      subject: parsedToken.payload.sub,
      email: typeof parsedToken.payload.email === 'string' ? parsedToken.payload.email : null,
      displayName: resolveDisplayName(parsedToken.payload)
    };
  }

  private async getSigningKey(kid: string): Promise<JwkKey | null> {
    const cached = await this.getJwks(false);
    const cachedKey = cached.get(kid);

    if (cachedKey) {
      return cachedKey;
    }

    const refreshed = await this.getJwks(true);
    return refreshed.get(kid) ?? null;
  }

  private async getJwks(forceRefresh: boolean): Promise<Map<string, JwkKey>> {
    if (this.inFlightJwksPromise !== null) {
      return this.inFlightJwksPromise;
    }

    if (!forceRefresh && this.jwksCache !== null && this.jwksCache.expiresAt > Date.now()) {
      return this.jwksCache.keys;
    }

    if (
      forceRefresh
      && this.lastRefreshAt !== null
      && (Date.now() - this.lastRefreshAt) < JWKS_FORCE_REFRESH_COOLDOWN_MS
    ) {
      return this.jwksCache?.keys ?? new Map<string, JwkKey>();
    }

    this.inFlightJwksPromise = fetch(this.jwksUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch Cognito JWKS: ${response.status}`);
        }

        const payload = await response.json() as JwksDocument;
        const keys = new Map<string, JwkKey>();

        for (const key of payload.keys ?? []) {
          if (typeof key.kid === 'string' && key.kid.length > 0) {
            keys.set(key.kid, key);
          }
        }

        this.jwksCache = {
          expiresAt: Date.now() + JWKS_TTL_MS,
          keys
        };

        if (forceRefresh) {
          this.lastRefreshAt = Date.now();
        }

        return keys;
      })
      .finally(() => {
        this.inFlightJwksPromise = null;
      });

    return this.inFlightJwksPromise;
  }
}

const extractBearerToken = (authorization: string | null): string | null => {
  if (authorization === null) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return null;
  }

  return token;
};

const parseJwt = (token: string): { header: JwtHeader; payload: JwtPayload } | null => {
  const segments = token.split('.');

  if (segments.length !== 3) {
    return null;
  }

  const header = decodeJwtSegment<JwtHeader>(segments[0]);
  const payload = decodeJwtSegment<JwtPayload>(segments[1]);

  if (header === null || payload === null) {
    return null;
  }

  return { header, payload };
};

const decodeJwtSegment = <T>(segment: string): T | null => {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(segment.length / 4) * 4, '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as unknown;

    return typeof parsed === 'object' && parsed !== null ? parsed as T : null;
  } catch {
    return null;
  }
};

const isUsableRsaSigningKey = (jwk: JwkKey, kid: string): jwk is Required<Pick<JwkKey, 'e' | 'kid' | 'kty' | 'n'>> & JwkKey => {
  return jwk.kid === kid
    && jwk.kty === 'RSA'
    && typeof jwk.n === 'string'
    && typeof jwk.e === 'string'
    && (jwk.use === undefined || jwk.use === 'sig')
    && (jwk.alg === undefined || jwk.alg === 'RS256');
};

const verifyJwtSignature = async (token: string, jwk: Required<Pick<JwkKey, 'e' | 'kid' | 'kty' | 'n'>>): Promise<boolean> => {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    const verificationData = toArrayBuffer(new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
    const signature = toArrayBuffer(decodeBase64UrlToBytes(encodedSignature));
    const key = await crypto.subtle.importKey(
      'jwk',
      {
        kty: jwk.kty,
        use: 'sig',
        alg: 'RS256',
        n: jwk.n,
        e: jwk.e,
        ext: true
      },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    );

    return crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, signature, verificationData);
  } catch {
    return false;
  }
};

const decodeBase64UrlToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const decoded = Buffer.from(padded, 'base64');
  return Uint8Array.from(decoded);
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const isTokenExpired = (exp: number | undefined): boolean => {
  if (!Number.isFinite(exp)) {
    return true;
  }

  return Number(exp) <= Math.floor(Date.now() / 1000);
};

const resolveDisplayName = (payload: JwtPayload): string | null => {
  if (typeof payload.name === 'string' && payload.name.trim().length > 0) {
    return payload.name.trim();
  }

  if (typeof payload['cognito:username'] === 'string' && payload['cognito:username'].trim().length > 0) {
    return payload['cognito:username'].trim();
  }

  return null;
};
