import type { OrderStatus } from './order-status.enum';

/** Line item embedded in the order document (not a separate table/row). */
export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

/** Cosmos DB order document (`type: "order"`, partition key `orderId`). */
export interface Order {
  id: string;
  type: 'order';
  orderId: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemInput {
  productId: string;
  quantity: number;
  price: number;
}

export interface CreateOrderInput {
  userId: string;
  items: CreateOrderItemInput[];
}
