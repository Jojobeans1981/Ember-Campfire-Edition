import type { HealthHandlers } from '../handlers/healthHandlers';
import type { RequestContext } from '../middleware/requestContext';

export const matchHealthRoute = (context: RequestContext, handlers: HealthHandlers): Response | null => {
  if (context.request.method === 'GET' && context.url.pathname === '/health') {
    return handlers.getHealth();
  }

  return null;
};
