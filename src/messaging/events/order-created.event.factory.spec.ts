import { OrderStatus } from '../../orders/domain/order-status.enum';
import type { Order } from '../../orders/domain/order.types';
import { ORDER_CREATED_EVENT_TYPE } from './event-types.constants';
import { buildOrderCreatedEvent } from './order-created.event.factory';

describe('buildOrderCreatedEvent', () => {
  const order: Order = {
    id: 'order-1',
    type: 'order',
    orderId: 'order-1',
    userId: 'user-100',
    status: OrderStatus.PENDING,
    items: [{ productId: 'p1', quantity: 2, price: 500 }],
    totalAmount: 1000,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  };

  it('builds a versioned OrderCreated envelope', () => {
    const event = buildOrderCreatedEvent(order);

    expect(event.eventType).toBe(ORDER_CREATED_EVENT_TYPE);
    expect(event.version).toBe(1);
    expect(event.correlationId).toBe(order.orderId);
    expect(event.data).toEqual({
      orderId: 'order-1',
      userId: 'user-100',
      status: OrderStatus.PENDING,
      totalAmount: 1000,
      itemCount: 1,
      items: [{ productId: 'p1', quantity: 2 }],
    });
  });
});
