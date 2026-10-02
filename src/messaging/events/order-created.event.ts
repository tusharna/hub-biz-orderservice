import type { OrderStatus } from '../../orders/domain/order-status.enum';
import type { EventEnvelope } from './event-envelope.types';

export interface OrderCreatedLine {
  productId: string;
  quantity: number;
}

export interface OrderCreatedData {
  orderId: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  items: OrderCreatedLine[];
}

export type OrderCreatedEvent = EventEnvelope<OrderCreatedData>;
