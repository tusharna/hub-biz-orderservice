import { StatusCodes } from '@azure/cosmos';
import { Test, TestingModule } from '@nestjs/testing';
import { CosmosService } from '../../cosmos/cosmos.service';
import { OrderStatus } from '../domain/order-status.enum';
import type { Order } from '../domain/order.types';
import { OrderConcurrencyConflictException } from '../exceptions/order-concurrency-conflict.exception';
import { CosmosOrderRepository } from './cosmos-order.repository';

describe('CosmosOrderRepository', () => {
  let repository: CosmosOrderRepository;
  let cosmosService: {
    createItem: jest.Mock;
    readItemByIdWithCharge: jest.Mock;
    replaceItem: jest.Mock;
    replaceItemIfMatch: jest.Mock;
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
      createItem: jest.fn(),
      readItemByIdWithCharge: jest.fn(),
      replaceItem: jest.fn(),
      replaceItemIfMatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CosmosOrderRepository,
        { provide: CosmosService, useValue: cosmosService },
      ],
    }).compile();

    repository = module.get(CosmosOrderRepository);
  });

  it('findByOrderIdWithEtag returns order and etag', async () => {
    cosmosService.readItemByIdWithCharge.mockResolvedValue({
      resource: order,
      requestChargeRu: 1,
      etag: 'etag-v1',
    });

    await expect(repository.findByOrderIdWithEtag('order-1')).resolves.toEqual({
      order,
      etag: 'etag-v1',
    });
  });

  it('replaceIfMatch returns updated etag', async () => {
    cosmosService.replaceItemIfMatch.mockResolvedValue({
      resource: order,
      etag: 'etag-v2',
      requestChargeRu: 5,
    });

    await expect(repository.replaceIfMatch(order, 'etag-v1')).resolves.toEqual({
      order,
      etag: 'etag-v2',
    });
  });

  it('replaceIfMatch maps Cosmos 412 to OrderConcurrencyConflictException', async () => {
    cosmosService.replaceItemIfMatch.mockRejectedValue({
      code: StatusCodes.PreconditionFailed,
    });

    await expect(
      repository.replaceIfMatch(order, 'stale-etag'),
    ).rejects.toBeInstanceOf(OrderConcurrencyConflictException);
  });
});
