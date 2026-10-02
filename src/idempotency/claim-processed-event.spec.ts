import { claimProcessedEvent } from './claim-processed-event';

describe('claimProcessedEvent', () => {
  it('claims the first delivery', async () => {
    const created: string[] = [];
    const claim = await claimProcessedEvent({
      consumer: 'payment-service',
      eventId: 'evt-1',
      orderId: 'order-1',
      ttlSeconds: 60,
      tryCreate: (document) => {
        created.push(document.id);
        return Promise.resolve();
      },
      isConflict: () => false,
    });
    expect(claim).toBe('claimed');
    expect(created).toEqual(['payment-service:evt-1']);
  });

  it('treats a conflict as a duplicate', async () => {
    const claim = await claimProcessedEvent({
      consumer: 'payment-service',
      eventId: 'evt-1',
      orderId: 'order-1',
      ttlSeconds: 60,
      tryCreate: () => Promise.reject(new Error('409')),
      isConflict: (error) => error instanceof Error && error.message === '409',
    });
    expect(claim).toBe('duplicate');
  });

  it('allows only one winner when two claims race', async () => {
    let stored = false;
    const tryCreate = () => {
      if (stored) {
        return Promise.reject(new Error('409'));
      }
      stored = true;
      return Promise.resolve();
    };
    const [first, second] = await Promise.all([
      claimProcessedEvent({
        consumer: 'payment-service',
        eventId: 'evt-1',
        orderId: 'order-1',
        ttlSeconds: 60,
        tryCreate,
        isConflict: (error) =>
          error instanceof Error && error.message === '409',
      }),
      claimProcessedEvent({
        consumer: 'payment-service',
        eventId: 'evt-1',
        orderId: 'order-1',
        ttlSeconds: 60,
        tryCreate,
        isConflict: (error) =>
          error instanceof Error && error.message === '409',
      }),
    ]);
    expect([first, second].sort()).toEqual(['claimed', 'duplicate']);
  });
});
