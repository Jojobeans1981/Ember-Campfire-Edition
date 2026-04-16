import type { IdentityProvisioningService } from '../../../application/services';
import type { AuthProvider } from '../../../infrastructure/auth';

import { AppError } from '../../../shared/errors/AppError';
import { ERROR_CODES } from '../../../shared/errors/ErrorCodes';
import type { RequestContext } from './requestContext';

export const authenticateRequest = async (
  context: RequestContext,
  dependencies: {
    authProvider: AuthProvider;
    identityProvisioningService: IdentityProvisioningService;
  }
): Promise<RequestContext> => {
  const identity = await dependencies.authProvider.authenticate({
    headers: context.request.headers
  });

  if (identity === null) {
    throw new AppError('Authentication required', {
      code: ERROR_CODES.UNAUTHORIZED,
      status: 401
    });
  }

  const currentUser = await dependencies.identityProvisioningService.resolve(identity);

  return {
    ...context,
    currentUser
  };
};

export const requireCurrentUser = (context: RequestContext) => {
  if (context.currentUser === null) {
    throw new AppError('Authentication required', {
      code: ERROR_CODES.UNAUTHORIZED,
      status: 401
    });
  }

  return context.currentUser;
};
