import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CosmosService } from '../../cosmos/cosmos.service';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import type { Order } from '../../orders/domain/order.types';
import { CosmosAccessPatternsService } from './cosmos-access-patterns.service';

describe('CosmosAccessPatternsService', () => {
  let service: CosmosAccessPatternsService;
  let cosmosService: {
    readItemByIdWithCharge: jest.MockedFunction<
      CosmosService['readItemByIdWithCharge']
    >;
    queryItemsWithCharge: jest.MockedFunction<
      CosmosService['queryItemsWithCharge']
    >;
  };

  const order: Order = {
    id: 'order-1',
    type: 'order',
    orderId: 'order-1',
    userId: 'user-100',
    status: OrderStatus.PENDING,
    items: [],
    totalAmount: 0,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  };

  beforeEach(async () => {
    cosmosService = {
      readItemByIdWithCharge: jest.fn(),
      queryItemsWithCharge: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CosmosAccessPatternsService,
        { provide: CosmosService, useValue: cosmosService },
      ],
    }).compile();

    service = module.get(CosmosAccessPatternsService);
  });

  it('demonstratePointRead returns partition-local point read metrics', async () => {
    cosmosService.readItemByIdWithCharge.mockResolvedValue({
      resource: order,
      requestChargeRu: 1.1,
    });

    const result = await service.demonstratePointRead('order-1');

    expect(result.pattern).toBe('point-read');
    expect(result.partitionScope).toBe('single-logical-partition');
    expect(result.requestChargeRu).toBe(1.1);
    expect(result.data).toEqual(order);
    expect(cosmosService.readItemByIdWithCharge).toHaveBeenCalledWith(
      'order-1',
      'order-1',
    );
  });

  it('demonstrateQueryByUserId runs cross-partition query', async () => {
    cosmosService.queryItemsWithCharge.mockResolvedValue({
      resources: [order],
      requestChargeRu: 5.5,
    });

    const result = await service.demonstrateQueryByUserId('user-100');

    expect(result.pattern).toBe('cross-partition-query');
    expect(result.partitionScope).toBe('cross-partition');
    expect(result.requestChargeRu).toBe(5.5);
    expect(cosmosService.queryItemsWithCharge.mock.calls[0]).toHaveLength(1);
  });

  it('demonstrateQueryByStatus validates status enum', async () => {
    await expect(
      service.demonstrateQueryByStatus('NOT_A_STATUS'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('demonstratePartitionScopedQuery passes partition key to Cosmos', async () => {
    cosmosService.queryItemsWithCharge.mockResolvedValue({
      resources: [order],
      requestChargeRu: 2.2,
    });

    const result = await service.demonstratePartitionScopedQuery('order-1');

    expect(result.pattern).toBe('partition-scoped-query');
    expect(result.partitionScope).toBe('single-logical-partition');
    expect(cosmosService.queryItemsWithCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('c.orderId') as string,
      }),
      'order-1',
    );
  });
});
