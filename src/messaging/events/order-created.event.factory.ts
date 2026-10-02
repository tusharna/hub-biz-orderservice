import { randomUUID } from 'node:crypto';
import type { Order } from '../../orders/domain/order.types';
import {
  ORDER_CREATED_EVENT_TYPE,
  ORDER_CREATED_EVENT_VERSION,
} from './event-types.constants';
import type { OrderCreatedEvent } from './order-created.event';

export function buildOrderCreatedEvent(
  order: Order,
  correlationId: string = order.orderId,
  causationId?: string,
): OrderCreatedEvent {
  return {
    eventId: randomUUID(),
    eventType: ORDER_CREATED_EVENT_TYPE,
    version: ORDER_CREATED_EVENT_VERSION,
    occurredAt: new Date().toISOString(),
    correlationId,
    causationId,
    data: {
      orderId: order.orderId,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
      items: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    },
  };
}
