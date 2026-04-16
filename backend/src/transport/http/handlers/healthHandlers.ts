import type { GetHealthCheckUseCase } from '../../../application/use-cases/GetHealthCheckUseCase';

export interface HealthHandlers {
  getHealth(): Response;
}

export const createHealthHandlers = (dependencies: {
  getHealthCheckUseCase: GetHealthCheckUseCase;
}): HealthHandlers => ({
  getHealth() {
    const payload = dependencies.getHealthCheckUseCase.execute();

    return Response.json(payload, { status: 200 });
  }
});
