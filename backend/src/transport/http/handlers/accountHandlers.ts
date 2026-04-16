import type { GetAccountUseCase } from '../../../application/use-cases/GetAccountUseCase';

import { requireCurrentUser } from '../middleware/authMiddleware';
import type { RequestContext } from '../middleware/requestContext';

export interface AccountHandlers {
  getAccount(context: RequestContext): Promise<Response>;
}

export const createAccountHandlers = (dependencies: {
  getAccountUseCase: GetAccountUseCase;
}): AccountHandlers => ({
  async getAccount(context) {
    const payload = await dependencies.getAccountUseCase.execute(requireCurrentUser(context));
    return Response.json(payload, { status: 200 });
  }
});
