import type { EventEnvelope } from '../messaging/events/event-envelope.types';
import type { OutboxEventDocument } from './outbox.types';

export function buildOutboxDocument<T>(
  envelope: EventEnvelope<T>,
  orderId: string,
): OutboxEventDocument {
  return {
    id: `outbox-${envelope.eventId}`,
    type: 'outbox',
    orderId,
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    status: 'PENDING',
    payload: envelope,
    correlationId: envelope.correlationId,
    createdAt: envelope.occurredAt,
    publishedAt: null,
    attempts: 0,
    lastError: null,
  };
}

export interface OutboxPublishResult {
  status: 'published' | 'retry';
  document: OutboxEventDocument;
}

/** Never marks published before send() resolves. */
export async function publishOutboxDocument(
  document: OutboxEventDocument,
  send: () => Promise<void>,
): Promise<OutboxPublishResult> {
  try {
    await send();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown send error';
    return {
      status: 'retry',
      document: {
        ...document,
        status: 'PENDING',
        attempts: document.attempts + 1,
        lastError: message,
        publishedAt: null,
      },
    };
  }

  return {
    status: 'published',
    document: {
      ...document,
      status: 'PUBLISHED',
      publishedAt: new Date().toISOString(),
      lastError: null,
    },
  };
}
