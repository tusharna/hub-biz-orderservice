export interface ProcessedEventDocument {
  id: string;
  type: 'processed-event';
  orderId: string;
  consumer: string;
  eventId: string;
  processedAt: string;
  /** Seconds. Requires container-level TTL enabled in Azure. Not set on order documents. */
  ttl: number;
}

export function processedEventId(consumer: string, eventId: string): string {
  return `${consumer}:${eventId}`;
}

export type IdempotencyClaim = 'claimed' | 'duplicate';

export async function claimProcessedEvent(options: {
  consumer: string;
  eventId: string;
  orderId: string;
  ttlSeconds: number;
  tryCreate: (document: ProcessedEventDocument) => Promise<void>;
  isConflict: (error: unknown) => boolean;
}): Promise<IdempotencyClaim> {
  const document: ProcessedEventDocument = {
    id: processedEventId(options.consumer, options.eventId),
    type: 'processed-event',
    orderId: options.orderId,
    consumer: options.consumer,
    eventId: options.eventId,
    processedAt: new Date().toISOString(),
    ttl: options.ttlSeconds,
  };
  try {
    await options.tryCreate(document);
    return 'claimed';
  } catch (error: unknown) {
    if (options.isConflict(error)) {
      return 'duplicate';
    }
    throw error;
  }
}
