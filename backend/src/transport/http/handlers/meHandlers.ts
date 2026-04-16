import type { GetCurrentUserUseCase } from '../../../application/use-cases/GetCurrentUserUseCase';

import { requireCurrentUser } from '../middleware/authMiddleware';
import type { RequestContext } from '../middleware/requestContext';

export interface MeHandlers {
  getMe(context: RequestContext): Promise<Response>;
}

export const createMeHandlers = (dependencies: {
  getCurrentUserUseCase: GetCurrentUserUseCase;
}): MeHandlers => ({
  async getMe(context) {
    const payload = await dependencies.getCurrentUserUseCase.execute(requireCurrentUser(context));
    return Response.json(payload, { status: 200 });
  }
});
