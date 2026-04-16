import type { AppendEventsUseCase } from '../../application/use-cases/AppendEventsUseCase';
import type { GetAccountUseCase } from '../../application/use-cases/GetAccountUseCase';
import type { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import type { GetHealthCheckUseCase } from '../../application/use-cases/GetHealthCheckUseCase';
import type { ListProfilesUseCase } from '../../application/use-cases/ListProfilesUseCase';
import type { CreateProfileUseCase } from '../../application/use-cases/CreateProfileUseCase';
import type { GetProfileProgressUseCase } from '../../application/use-cases/GetProfileProgressUseCase';
import type { SubmitProgressOperationBatchUseCase } from '../../application/use-cases/SubmitProgressOperationBatchUseCase';
import type { SubmitProgressSnapshotUseCase } from '../../application/use-cases/SubmitProgressSnapshotUseCase';
import type { IdentityProvisioningService } from '../../application/services';
import type { AuthProvider } from '../../infrastructure/auth';
import type { AppConfig } from '../../infrastructure/config/env';
import { AppError } from '../../shared/errors/AppError';
import { ERROR_CODES } from '../../shared/errors/ErrorCodes';
import { createAccountHandlers } from './handlers/accountHandlers';
import { createHealthHandlers } from './handlers/healthHandlers';
import { createMeHandlers } from './handlers/meHandlers';
import { createProfileHandlers } from './handlers/profileHandlers';
import { authenticateRequest } from './middleware/authMiddleware';
import { withErrorHandling } from './middleware/errorMiddleware';
import { createRequestContext } from './middleware/requestContext';
import { matchAccountRoute } from './routes/accountRoutes';
import { matchHealthRoute } from './routes/healthRoutes';
import { matchMeRoute } from './routes/meRoutes';
import { matchProfileRoute } from './routes/profileRoutes';

export interface HttpServer {
  start(): void;
  stop(): Promise<void>;
  handle(request: Request): Promise<Response>;
}

export const createHttpServer = (dependencies: {
  config: AppConfig;
  getHealthCheckUseCase: GetHealthCheckUseCase;
  getCurrentUserUseCase: GetCurrentUserUseCase;
  getAccountUseCase: GetAccountUseCase;
  listProfilesUseCase: ListProfilesUseCase;
  createProfileUseCase: CreateProfileUseCase;
  getProfileProgressUseCase: GetProfileProgressUseCase;
  submitProgressOperationBatchUseCase: SubmitProgressOperationBatchUseCase;
  submitProgressSnapshotUseCase: SubmitProgressSnapshotUseCase;
  appendEventsUseCase: AppendEventsUseCase;
  authProvider: AuthProvider;
  identityProvisioningService: IdentityProvisioningService;
}): HttpServer => {
  let server: ReturnType<typeof Bun.serve> | null = null;

  const getCorsOrigin = (request: Request): string | null => {
    const requestOrigin = request.headers.get('origin');

    if (!requestOrigin) {
      return null;
    }

    if (dependencies.config.cors.allowedOrigins.includes('*')) {
      return '*';
    }

    return dependencies.config.cors.allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : null;
  };

  const withCorsHeaders = (request: Request, response: Response): Response => {
    const corsOrigin = getCorsOrigin(request);

    if (!corsOrigin) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', corsOrigin);
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'authorization,content-type');
    headers.set('Access-Control-Max-Age', '86400');

    if (corsOrigin !== '*') {
      headers.set('Vary', 'Origin');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  const healthHandlers = createHealthHandlers({
    getHealthCheckUseCase: dependencies.getHealthCheckUseCase
  });
  const meHandlers = createMeHandlers({
    getCurrentUserUseCase: dependencies.getCurrentUserUseCase
  });
  const accountHandlers = createAccountHandlers({
    getAccountUseCase: dependencies.getAccountUseCase
  });
  const profileHandlers = createProfileHandlers({
    listProfilesUseCase: dependencies.listProfilesUseCase,
    createProfileUseCase: dependencies.createProfileUseCase,
    getProfileProgressUseCase: dependencies.getProfileProgressUseCase,
    submitProgressOperationBatchUseCase: dependencies.submitProgressOperationBatchUseCase,
    submitProgressSnapshotUseCase: dependencies.submitProgressSnapshotUseCase,
    appendEventsUseCase: dependencies.appendEventsUseCase
  });

  const handle = async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') {
      return withCorsHeaders(request, new Response(null, { status: 204 }));
    }

    const response = await withErrorHandling(async () => {
      const context = createRequestContext(request);
      const healthResponse = matchHealthRoute(context, healthHandlers);

      if (healthResponse) {
        return healthResponse;
      }

      const authenticatedContext = await authenticateRequest(context, {
        authProvider: dependencies.authProvider,
        identityProvisioningService: dependencies.identityProvisioningService
      });

      const meResponse = await matchMeRoute(authenticatedContext, meHandlers);

      if (meResponse) {
        return meResponse;
      }

      const accountResponse = await matchAccountRoute(authenticatedContext, accountHandlers);

      if (accountResponse) {
        return accountResponse;
      }

      const profileResponse = await matchProfileRoute(authenticatedContext, profileHandlers);

      if (profileResponse) {
        return profileResponse;
      }

      throw new AppError('Route not found', {
        code: ERROR_CODES.NOT_FOUND,
        status: 404
      });
    });

    return withCorsHeaders(request, response);
  };

  return {
    start() {
      server = Bun.serve({
        hostname: dependencies.config.host,
        port: dependencies.config.port,
        fetch: handle
      });

      console.log(
        `Backend server listening on http://${dependencies.config.host}:${dependencies.config.port}`
      );
    },
    async stop() {
      await server?.stop();
    },
    handle
  };
};
