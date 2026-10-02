import type { OrderWithEtag } from '../domain/order-with-etag.types';
import type { Order } from '../domain/order.types';
import type { OutboxEventDocument } from '../../outbox/outbox.types';

/** Persistence port for order documents (Cosmos DB in this project). */
export interface OrderRepository {
  create(order: Order): Promise<Order>;
  createWithOutbox(order: Order, outbox: OutboxEventDocument): Promise<Order>;
  findByOrderId(orderId: string): Promise<Order | null>;
  findByOrderIdWithEtag(orderId: string): Promise<OrderWithEtag | null>;
  replace(order: Order): Promise<Order>;
  replaceIfMatch(order: Order, etag: string): Promise<OrderWithEtag>;
}

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');
