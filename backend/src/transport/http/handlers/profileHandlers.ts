import type { AppendEventsUseCase } from '../../../application/use-cases/AppendEventsUseCase';
import type { CreateProfileUseCase } from '../../../application/use-cases/CreateProfileUseCase';
import type { GetProfileProgressUseCase } from '../../../application/use-cases/GetProfileProgressUseCase';
import type { ListProfilesUseCase } from '../../../application/use-cases/ListProfilesUseCase';
import type { SubmitProgressOperationBatchUseCase } from '../../../application/use-cases/SubmitProgressOperationBatchUseCase';
import type { SubmitProgressSnapshotUseCase } from '../../../application/use-cases/SubmitProgressSnapshotUseCase';

import { requireCurrentUser } from '../middleware/authMiddleware';
import type { RequestContext } from '../middleware/requestContext';
import { parseCreateProfileRequest } from '../validators/profileValidators';
import {
  parseAppendEventsRequest,
  parseProfileIdParam,
  parseSubmitProgressOperationBatchRequest,
  parseSubmitProgressSnapshotRequest
} from '../validators/progressValidators';

export interface ProfileHandlers {
  listProfiles(context: RequestContext): Promise<Response>;
  createProfile(context: RequestContext): Promise<Response>;
  getProfileProgress(context: RequestContext, profileId: string): Promise<Response>;
  submitProgressOperationBatch(context: RequestContext, profileId: string): Promise<Response>;
  submitProgressSnapshot(context: RequestContext, profileId: string): Promise<Response>;
  appendEvents(context: RequestContext, profileId: string): Promise<Response>;
}

export const createProfileHandlers = (dependencies: {
  appendEventsUseCase: AppendEventsUseCase;
  listProfilesUseCase: ListProfilesUseCase;
  createProfileUseCase: CreateProfileUseCase;
  getProfileProgressUseCase: GetProfileProgressUseCase;
  submitProgressOperationBatchUseCase: SubmitProgressOperationBatchUseCase;
  submitProgressSnapshotUseCase: SubmitProgressSnapshotUseCase;
}): ProfileHandlers => ({
  async listProfiles(context) {
    const payload = await dependencies.listProfilesUseCase.execute(requireCurrentUser(context));
    return Response.json(payload, { status: 200 });
  },
  async createProfile(context) {
    const input = await parseCreateProfileRequest(context.request);
    const payload = await dependencies.createProfileUseCase.execute(requireCurrentUser(context), input);
    return Response.json(payload, { status: 201 });
  },
  async getProfileProgress(context, profileId) {
    const payload = await dependencies.getProfileProgressUseCase.execute(
      requireCurrentUser(context),
      parseProfileIdParam(profileId)
    );

    return Response.json(payload, { status: 200 });
  },
  async submitProgressOperationBatch(context, profileId) {
    const input = await parseSubmitProgressOperationBatchRequest(context.request, profileId);
    const payload = await dependencies.submitProgressOperationBatchUseCase.execute(
      requireCurrentUser(context),
      input
    );

    return Response.json(payload, { status: 200 });
  },
  async submitProgressSnapshot(context, profileId) {
    const input = await parseSubmitProgressSnapshotRequest(context.request, profileId);
    const payload = await dependencies.submitProgressSnapshotUseCase.execute(
      requireCurrentUser(context),
      input
    );

    return Response.json(payload, { status: 200 });
  },
  async appendEvents(context, profileId) {
    const input = await parseAppendEventsRequest(context.request, profileId);
    const payload = await dependencies.appendEventsUseCase.execute(requireCurrentUser(context), input);

    return Response.json(payload, { status: 200 });
  }
});
