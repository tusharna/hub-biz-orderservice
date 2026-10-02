import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ORDER_DOCUMENT_TYPE } from './domain/order.constants';
import { OrderStatus } from './domain/order-status.enum';
import type {
  OrderWithEtag,
  OrderWithEtagResponse,
} from './domain/order-with-etag.types';
import type { CreateOrderInput, Order, OrderItem } from './domain/order.types';
import { OrderConcurrencyConflictException } from './exceptions/order-concurrency-conflict.exception';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from './repositories/order.repository';
import {
  calculateOrderTotalAmount,
  validateCreateOrderInput,
} from './validation/order.validation';
import { buildOrderCreatedEvent } from '../messaging/events/order-created.event.factory';
import { buildOutboxDocument } from '../outbox/outbox-publish';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepository,
  ) {}

  async createOrder(input: CreateOrderInput): Promise<Order> {
    validateCreateOrderInput(input);

    const items: OrderItem[] = input.items.map((item) => ({
      productId: item.productId.trim(),
      quantity: item.quantity,
      price: item.price,
    }));
    const totalAmount = calculateOrderTotalAmount(items);
    const orderId = `order-${randomUUID()}`;
    const timestamp = new Date().toISOString();

    const order: Order = {
      id: orderId,
      type: ORDER_DOCUMENT_TYPE,
      orderId,
      userId: input.userId.trim(),
      status: OrderStatus.PENDING,
      items,
      totalAmount,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const created = await this.orderRepository.createWithOutbox(
      order,
      buildOutboxDocument(buildOrderCreatedEvent(order), order.orderId),
    );
    return created;
  }

  async getOrder(orderId: string): Promise<Order> {
    const { order } = await this.getOrderWithEtag(orderId);
    return order;
  }

  async getOrderWithEtag(orderId: string): Promise<OrderWithEtag> {
    const trimmedId = orderId.trim();
    if (trimmedId.length === 0) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    const result = await this.orderRepository.findByOrderIdWithEtag(trimmedId);
    if (!result) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    return result;
  }

  toOrderResponse(withEtag: OrderWithEtag): OrderWithEtagResponse {
    return { ...withEtag.order, etag: withEtag.etag };
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
  ): Promise<Order> {
    const current = await this.getOrderWithEtag(orderId);
    const updated = await this.updateOrderStatusIfMatch(
      orderId,
      status,
      current.etag,
    );
    return updated.order;
  }

  async updateOrderStatusIfMatch(
    orderId: string,
    status: OrderStatus,
    etag: string,
  ): Promise<OrderWithEtag> {
    if (!Object.values(OrderStatus).includes(status)) {
      throw new BadRequestException(`Invalid order status: ${String(status)}`);
    }
    if (!etag.trim()) {
      throw new BadRequestException('etag must not be empty.');
    }

    const current = await this.getOrderWithEtag(orderId);
    const updatedOrder: Order = {
      ...current.order,
      status,
      updatedAt: new Date().toISOString(),
    };

    return this.orderRepository.replaceIfMatch(updatedOrder, etag);
  }

  /**
   * Learning helper: two writers start from the same etag; the second update should fail.
   */
  async simulateConcurrentStatusUpdates(
    orderId: string,
    sharedEtag: string,
    firstStatus: OrderStatus,
    secondStatus: OrderStatus,
  ): Promise<{
    firstWriter: OrderWithEtag;
    secondWriterError: OrderConcurrencyConflictException;
  }> {
    const firstWriter = await this.updateOrderStatusIfMatch(
      orderId,
      firstStatus,
      sharedEtag,
    );

    let secondWriterError: OrderConcurrencyConflictException | undefined;
    try {
      await this.updateOrderStatusIfMatch(orderId, secondStatus, sharedEtag);
    } catch (error: unknown) {
      if (error instanceof OrderConcurrencyConflictException) {
        secondWriterError = error;
      } else {
        throw error;
      }
    }

    if (!secondWriterError) {
      throw new Error(
        'Expected second writer to fail with a concurrency conflict.',
      );
    }

    return { firstWriter, secondWriterError };
  }
}
