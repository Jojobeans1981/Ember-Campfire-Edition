import type { MeHandlers } from '../handlers/meHandlers';
import type { RequestContext } from '../middleware/requestContext';

export const matchMeRoute = async (
  context: RequestContext,
  handlers: MeHandlers
): Promise<Response | null> => {
  if (context.request.method === 'GET' && context.url.pathname === '/me') {
    return handlers.getMe(context);
  }

  return null;
};
