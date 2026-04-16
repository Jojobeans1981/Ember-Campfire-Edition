import type { CurrentUserContext } from '../../../application/CurrentUserContext';

export interface RequestContext {
  request: Request;
  url: URL;
  currentUser: CurrentUserContext | null;
}

export const createRequestContext = (request: Request): RequestContext => ({
  request,
  url: new URL(request.url),
  currentUser: null
});
