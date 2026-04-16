import type { DomainEventRecord } from '../../../../domain/repositories/EventRepository';

import { fromJsonField } from '../jsonFields';

export interface EventRow {
  id: string;
  profile_id: string;
  client_event_id: string;
  event_type: string;
  occurred_at: Date;
  schema_version: number;
  payload: unknown;
  received_at: Date;
}

export const mapEventRow = (row: EventRow): DomainEventRecord => ({
  id: row.id,
  profileId: row.profile_id,
  clientEventId: row.client_event_id,
  eventType: row.event_type,
  occurredAt: row.occurred_at,
  schemaVersion: row.schema_version,
  payload: fromJsonField<Record<string, unknown>>(row.payload),
  receivedAt: row.received_at
});
