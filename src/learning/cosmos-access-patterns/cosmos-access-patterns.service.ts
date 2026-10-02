import { BadRequestException, Injectable } from '@nestjs/common';
import { CosmosService } from '../../cosmos/cosmos.service';
import { ORDER_DOCUMENT_TYPE } from '../../orders/domain/order.constants';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import type { Order } from '../../orders/domain/order.types';
import type { CosmosAccessPatternDemoResponse } from './cosmos-access-patterns.types';

@Injectable()
export class CosmosAccessPatternsService {
  constructor(private readonly cosmosService: CosmosService) {}

  async demonstratePointRead(
    orderId: string,
  ): Promise<CosmosAccessPatternDemoResponse<Order | null>> {
    const trimmed = orderId.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('orderId must not be empty.');
    }

    const { resource, requestChargeRu } =
      await this.cosmosService.readItemByIdWithCharge(trimmed, trimmed);

    const order =
      resource && resource['type'] === ORDER_DOCUMENT_TYPE
        ? (resource as unknown as Order)
        : null;

    return {
      pattern: 'point-read',
      partitionScope: 'single-logical-partition',
      requestChargeRu,
      resultCount: order ? 1 : 0,
      data: order,
      note: 'Direct lookup by document id + partition key (orderId). Typically the lowest-latency, lowest-RU way to fetch one order.',
    };
  }

  async demonstrateQueryByUserId(
    userId: string,
  ): Promise<CosmosAccessPatternDemoResponse<Order[]>> {
    const trimmed = userId.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('userId must not be empty.');
    }

    const { resources, requestChargeRu } =
      await this.cosmosService.queryItemsWithCharge({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.userId = @userId ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: ORDER_DOCUMENT_TYPE },
          { name: '@userId', value: trimmed },
        ],
      });

    return {
      pattern: 'cross-partition-query',
      partitionScope: 'cross-partition',
      requestChargeRu,
      resultCount: resources.length,
      data: resources as unknown as Order[],
      note: 'userId is not the partition key (/orderId), so this query fan-outs across logical partitions. Compare requestChargeRu with a point read.',
    };
  }

  async demonstrateQueryByStatus(
    status: string,
  ): Promise<CosmosAccessPatternDemoResponse<Order[]>> {
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new BadRequestException(
        `Invalid status. Expected one of: ${Object.values(OrderStatus).join(', ')}`,
      );
    }

    const { resources, requestChargeRu } =
      await this.cosmosService.queryItemsWithCharge({
        query:
          'SELECT * FROM c WHERE c.type = @type AND c.status = @status ORDER BY c.createdAt DESC',
        parameters: [
          { name: '@type', value: ORDER_DOCUMENT_TYPE },
          { name: '@status', value: status },
        ],
      });

    return {
      pattern: 'cross-partition-query',
      partitionScope: 'cross-partition',
      requestChargeRu,
      resultCount: resources.length,
      data: resources as unknown as Order[],
      note: 'status is not the partition key, so Cosmos must search more than one logical partition. Useful for ops/reporting; expensive at scale without a tailored index/container design.',
    };
  }

  /**
   * Contrast demo: same container, but query scoped to one logical partition (orderId).
   * Still a query (not a point read), yet partition-local.
   */
  async demonstratePartitionScopedQuery(
    orderId: string,
  ): Promise<CosmosAccessPatternDemoResponse<Order[]>> {
    const trimmed = orderId.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException('orderId must not be empty.');
    }

    const { resources, requestChargeRu } =
      await this.cosmosService.queryItemsWithCharge(
        {
          query:
            'SELECT * FROM c WHERE c.type = @type AND c.orderId = @orderId',
          parameters: [
            { name: '@type', value: ORDER_DOCUMENT_TYPE },
            { name: '@orderId', value: trimmed },
          ],
        },
        trimmed,
      );

    return {
      pattern: 'partition-scoped-query',
      partitionScope: 'single-logical-partition',
      requestChargeRu,
      resultCount: resources.length,
      data: resources as unknown as Order[],
      note: 'Supplying partitionKey=orderId limits work to one logical partition. Compare RU with cross-partition queries and with a point read for the same order.',
    };
  }
}
