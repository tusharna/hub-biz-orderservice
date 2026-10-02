import { Injectable } from '@nestjs/common';
import type { JSONObject } from '@azure/cosmos';
import { isCosmosPreconditionFailedError } from '../../cosmos/cosmos-error.utils';
import { CosmosService } from '../../cosmos/cosmos.service';
import { ORDER_DOCUMENT_TYPE } from '../domain/order.constants';
import type { OrderWithEtag } from '../domain/order-with-etag.types';
import type { Order } from '../domain/order.types';
import { OrderConcurrencyConflictException } from '../exceptions/order-concurrency-conflict.exception';
import type { OutboxEventDocument } from '../../outbox/outbox.types';
import type { OrderRepository } from './order.repository';

@Injectable()
export class CosmosOrderRepository implements OrderRepository {
  constructor(private readonly cosmosService: CosmosService) {}

  async create(order: Order): Promise<Order> {
    return this.cosmosService.createItem(order);
  }

  async createWithOutbox(
    order: Order,
    outbox: OutboxEventDocument,
  ): Promise<Order> {
    await this.cosmosService.executePartitionBatch(order.orderId, [
      {
        operationType: 'Create',
        resourceBody: order as unknown as JSONObject,
      },
      {
        operationType: 'Create',
        resourceBody: outbox as unknown as JSONObject,
      },
    ]);
    return order;
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    const withEtag = await this.findByOrderIdWithEtag(orderId);
    return withEtag?.order ?? null;
  }

  async findByOrderIdWithEtag(orderId: string): Promise<OrderWithEtag | null> {
    const { resource, etag } = await this.cosmosService.readItemByIdWithCharge(
      orderId,
      orderId,
    );
    if (!resource || resource['type'] !== ORDER_DOCUMENT_TYPE || !etag) {
      return null;
    }
    return {
      order: resource as unknown as Order,
      etag,
    };
  }

  async replace(order: Order): Promise<Order> {
    return this.cosmosService.replaceItem(order);
  }

  async replaceIfMatch(order: Order, etag: string): Promise<OrderWithEtag> {
    try {
      const { resource, etag: newEtag } =
        await this.cosmosService.replaceItemIfMatch(order, etag);
      return { order: resource, etag: newEtag };
    } catch (error: unknown) {
      if (isCosmosPreconditionFailedError(error)) {
        throw new OrderConcurrencyConflictException(order.orderId);
      }
      throw error;
    }
  }
}
