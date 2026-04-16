import type { ProfileId } from '../value-objects/ProfileId';
import type { Transaction } from '../../shared/persistence';

export interface DomainEventRecord {
  id: string;
  profileId: ProfileId;
  clientEventId: string;
  eventType: string;
  occurredAt: Date;
  schemaVersion: number;
  payload: Record<string, unknown>;
  receivedAt: Date;
}

export interface EventRepository {
  hasClientEvent(profileId: ProfileId, clientEventId: string, transaction?: Transaction): Promise<boolean>;
  append(event: DomainEventRecord, transaction?: Transaction): Promise<boolean>;
}
