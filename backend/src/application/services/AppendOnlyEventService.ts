import type { EventBatchEventDto, EventBatchResponseDto } from '../dto/EventBatchDto';
import type { EventRepository } from '../../domain/repositories';
import type { TransactionManager } from '../../shared/persistence';
import type { Clock } from '../../shared/time/Clock';
import type { IdGenerator } from '../../shared/ids/IdGenerator';

export class AppendOnlyEventService {
  public constructor(private readonly dependencies: {
    eventRepository: EventRepository;
    transactionManager: TransactionManager;
    idGenerator: IdGenerator;
    clock: Clock;
  }) {}

  public async append(profileId: string, events: EventBatchEventDto[]): Promise<EventBatchResponseDto> {
    return this.dependencies.transactionManager.withTransaction(async (transaction) => {
      const now = this.dependencies.clock.now();
      const seenClientEventIds = new Set<string>();
      const appended: EventBatchResponseDto['appended'] = [];
      const duplicate: EventBatchResponseDto['duplicate'] = [];

      for (const event of events) {
        if (seenClientEventIds.has(event.clientEventId)) {
          duplicate.push({ clientEventId: event.clientEventId });
          continue;
        }

        seenClientEventIds.add(event.clientEventId);
        const inserted = await this.dependencies.eventRepository.append(
          {
            id: this.dependencies.idGenerator.generate(),
            profileId,
            clientEventId: event.clientEventId,
            eventType: event.eventType,
            occurredAt: event.occurredAt,
            schemaVersion: event.schemaVersion,
            payload: event.payload,
            receivedAt: now
          },
          transaction
        );

        if (!inserted) {
          duplicate.push({ clientEventId: event.clientEventId });
          continue;
        }

        appended.push({ clientEventId: event.clientEventId });
      }

      return {
        profileId,
        appended,
        duplicate
      };
    });
  }
}
