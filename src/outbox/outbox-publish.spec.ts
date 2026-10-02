import { publishOutboxDocument } from './outbox-publish';
import type { OutboxEventDocument } from './outbox.types';

const pending: OutboxEventDocument = {
  id: 'outbox-evt-1',
  type: 'outbox',
  orderId: 'order-1',
  eventId: 'evt-1',
  eventType: 'OrderCreated',
  status: 'PENDING',
  payload: { eventId: 'evt-1' },
  correlationId: 'order-1',
  createdAt: '2026-09-20T10:00:00.000Z',
  publishedAt: null,
  attempts: 0,
  lastError: null,
};

describe('publishOutboxDocument', () => {
  it('marks published only after send succeeds', async () => {
    const result = await publishOutboxDocument(pending, () =>
      Promise.resolve(),
    );
    expect(result.status).toBe('published');
    expect(result.document.status).toBe('PUBLISHED');
    expect(result.document.publishedAt).not.toBeNull();
  });

  it('keeps the event unpublished when Service Bus send fails', async () => {
    const result = await publishOutboxDocument(pending, () =>
      Promise.reject(new Error('service bus unavailable')),
    );
    expect(result.status).toBe('retry');
    expect(result.document.status).toBe('PENDING');
    expect(result.document.publishedAt).toBeNull();
    expect(result.document.attempts).toBe(1);
    expect(result.document.lastError).toContain('unavailable');
  });
});
