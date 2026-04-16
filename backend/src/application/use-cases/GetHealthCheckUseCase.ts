import type { HealthCheckDto } from '../dto/HealthCheckDto';
import type { Clock } from '../../shared/time/Clock';

export class GetHealthCheckUseCase {
  public constructor(private readonly clock: Clock) {}

  public execute(): HealthCheckDto {
    return {
      status: 'ok',
      service: 'ember-campfire-backend',
      timestamp: this.clock.now().toISOString()
    };
  }
}
