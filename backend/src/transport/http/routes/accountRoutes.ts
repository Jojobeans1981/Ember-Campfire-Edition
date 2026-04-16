import type { AccountHandlers } from '../handlers/accountHandlers';
import type { RequestContext } from '../middleware/requestContext';

export const matchAccountRoute = async (
  context: RequestContext,
  handlers: AccountHandlers
): Promise<Response | null> => {
  if (context.request.method === 'GET' && context.url.pathname === '/account') {
    return handlers.getAccount(context);
  }

  return null;
};
