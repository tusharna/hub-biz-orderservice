export type OutboxStatus = 'PENDING' | 'PUBLISHED' | 'FAILED';

export interface OutboxEventDocument {
  id: string;
  type: 'outbox';
  orderId: string;
  eventId: string;
  eventType: string;
  status: OutboxStatus;
  payload: unknown;
  correlationId: string;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
}

export const OUTBOX_CHECKPOINT_ID = 'outbox-publisher-checkpoint';
