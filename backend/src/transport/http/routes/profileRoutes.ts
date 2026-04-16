import type { ProfileHandlers } from '../handlers/profileHandlers';
import type { RequestContext } from '../middleware/requestContext';

export const matchProfileRoute = async (
  context: RequestContext,
  handlers: ProfileHandlers
): Promise<Response | null> => {
  const progressRouteMatch = context.url.pathname.match(/^\/profiles\/([^/]+)\/progress$/);

  if (progressRouteMatch) {
    if (context.request.method === 'GET') {
      return handlers.getProfileProgress(context, progressRouteMatch[1]!);
    }

    return null;
  }

  const progressOperationsRouteMatch = context.url.pathname.match(/^\/profiles\/([^/]+)\/progress-operations$/);

  if (progressOperationsRouteMatch) {
    if (context.request.method === 'POST') {
      return handlers.submitProgressOperationBatch(context, progressOperationsRouteMatch[1]!);
    }

    return null;
  }

  const progressSnapshotRouteMatch = context.url.pathname.match(/^\/profiles\/([^/]+)\/progress-snapshot$/);

  if (progressSnapshotRouteMatch) {
    if (context.request.method === 'PUT') {
      return handlers.submitProgressSnapshot(context, progressSnapshotRouteMatch[1]!);
    }

    return null;
  }

  const eventsRouteMatch = context.url.pathname.match(/^\/profiles\/([^/]+)\/events$/);

  if (eventsRouteMatch) {
    if (context.request.method === 'POST') {
      return handlers.appendEvents(context, eventsRouteMatch[1]!);
    }

    return null;
  }

  if (context.url.pathname !== '/profiles') {
    return null;
  }

  if (context.request.method === 'GET') {
    return handlers.listProfiles(context);
  }

  if (context.request.method === 'POST') {
    return handlers.createProfile(context);
  }

  return null;
};
