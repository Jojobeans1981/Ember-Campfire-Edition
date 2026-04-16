import type { AuthIdentity } from '../../../domain/models/AuthIdentity';
import type { DevAuthUserConfig } from '../../config/env';
import type { AuthProvider, RequestAuthContext } from '../AuthProvider';

export class DevAuthProvider implements AuthProvider {
  private readonly usersByKey: Map<string, DevAuthUserConfig>;

  public constructor(private readonly dependencies: {
    env: string;
    users: DevAuthUserConfig[];
  }) {
    this.usersByKey = new Map(dependencies.users.map((user) => [user.key, user]));
  }

  public async authenticate(request: RequestAuthContext): Promise<AuthIdentity | null> {
    if (this.dependencies.env === 'production') {
      return null;
    }

    const authorization = request.headers.get('authorization');

    if (authorization === null) {
      return null;
    }

    const match = authorization.match(/^Bearer\s+dev:(.+)$/i);

    if (match === null) {
      return null;
    }

    const key = match[1]?.trim();

    if (key === undefined || key.length === 0) {
      return null;
    }

    const user = this.usersByKey.get(key);

    if (user === undefined) {
      return null;
    }

    return {
      provider: 'dev',
      subject: user.subject,
      email: user.email,
      displayName: user.displayName
    };
  }
}
