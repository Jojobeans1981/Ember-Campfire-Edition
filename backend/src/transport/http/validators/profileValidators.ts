import type { CreateProfileInput } from '../../../application/use-cases/CreateProfileUseCase';

import { assertMaxLength, assertNonEmptyString, parseJsonObjectBody } from './commonValidators';

export const parseCreateProfileRequest = async (request: Request): Promise<CreateProfileInput> => {
  const body = await parseJsonObjectBody(request);
  const name = assertMaxLength(assertNonEmptyString(body.name, 'name'), 'name', 100);

  return { name };
};
