export interface EventBatchEventDto {
  clientEventId: string;
  eventType: string;
  occurredAt: Date;
  schemaVersion: number;
  payload: Record<string, unknown>;
}

export interface EventBatchRequestDto {
  profileId: string;
  events: EventBatchEventDto[];
}

export interface EventBatchResponseDto {
  profileId: string;
  appended: Array<{
    clientEventId: string;
  }>;
  duplicate: Array<{
    clientEventId: string;
  }>;
}
