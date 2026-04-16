import type { DomainEventRecord, EventRepository } from '../../../domain/repositories';
import type { Transaction } from '../../../shared/persistence';
import type { Database } from '../Database';

import { resolveDbExecutor } from './DbExecutor';
import { toJsonField } from './jsonFields';

interface CountRow {
  count: number;
}

export class SqlEventRepository implements EventRepository {
  public constructor(private readonly database: Database) {}

  public async hasClientEvent(profileId: string, clientEventId: string, transaction?: Transaction): Promise<boolean> {
    const executor = resolveDbExecutor(this.database, transaction);
    const rows = await executor<CountRow[]>`
      select count(*)::int as count
      from event_log
      where profile_id = ${profileId}
        and client_event_id = ${clientEventId}
    `;

    return rows[0]?.count === 1;
  }

  public async append(event: DomainEventRecord, transaction?: Transaction): Promise<boolean> {
    const executor = resolveDbExecutor(this.database, transaction);

    const rows = await executor<Array<{ inserted: boolean }>>`
      insert into event_log (
        id,
        profile_id,
        client_event_id,
        event_type,
        occurred_at,
        schema_version,
        payload,
        received_at
      )
      values (
        ${event.id},
        ${event.profileId},
        ${event.clientEventId},
        ${event.eventType},
        ${event.occurredAt},
        ${event.schemaVersion},
        ${toJsonField(executor, event.payload)},
        ${event.receivedAt}
      )
      on conflict (profile_id, client_event_id) do nothing
      returning true as inserted
    `;

    return rows.length === 1;
  }
}
