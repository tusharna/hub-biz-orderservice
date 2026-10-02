import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { Container } from '@azure/cosmos';
import configuration from '../config/configuration';
import { validateEnvironment } from '../config/env.validation';
import { CosmosService } from './cosmos.service';

describe('CosmosService', () => {
  let service: CosmosService;
  let mockContainer: {
    read: jest.Mock;
    items: {
      create: jest.Mock;
      query: jest.Mock;
    };
    item: jest.Mock;
  };

  beforeEach(async () => {
    mockContainer = {
      read: jest.fn(),
      items: {
        create: jest.fn(),
        query: jest.fn(),
      },
      item: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          validate: validateEnvironment,
        }),
      ],
      providers: [CosmosService],
    }).compile();

    service = module.get(CosmosService);
    jest
      .spyOn(service, 'getOrdersContainer')
      .mockReturnValue(mockContainer as unknown as Container);
    jest.spyOn(service, 'getDatabase').mockImplementation(() => {
      throw new Error('getDatabase should not be called in these tests');
    });
  });

  it('checkHealth returns up when container metadata read succeeds', async () => {
    mockContainer.read.mockResolvedValue({});
    await expect(service.checkHealth()).resolves.toEqual({ status: 'up' });
  });

  it('checkHealth returns down when container metadata read fails', async () => {
    mockContainer.read.mockRejectedValue(new Error('connection refused'));
    await expect(service.checkHealth()).resolves.toEqual({
      status: 'down',
      message: 'connection refused',
    });
  });

  it('createItem sends document to the orders container', async () => {
    const item = { id: 'order-1', orderId: 'order-1', status: 'PENDING' };
    mockContainer.items.create.mockResolvedValue({ resource: item });

    await expect(service.createItem(item)).resolves.toEqual(item);
    expect(mockContainer.items.create).toHaveBeenCalledWith(item);
  });

  it('readItemById performs a point read with id and orderId', async () => {
    const readMock = jest.fn().mockResolvedValue({
      resource: { id: 'order-1', orderId: 'order-1' },
      requestCharge: 1,
    });
    mockContainer.item.mockReturnValue({ read: readMock });

    await expect(service.readItemById('order-1', 'order-1')).resolves.toEqual({
      id: 'order-1',
      orderId: 'order-1',
    });
    expect(mockContainer.item).toHaveBeenCalledWith('order-1', 'order-1');
  });

  it('readItemByIdWithCharge returns resource and RU', async () => {
    const readMock = jest.fn().mockResolvedValue({
      resource: { id: 'order-1', orderId: 'order-1' },
      requestCharge: 1.23,
    });
    mockContainer.item.mockReturnValue({ read: readMock });

    await expect(
      service.readItemByIdWithCharge('order-1', 'order-1'),
    ).resolves.toEqual({
      resource: { id: 'order-1', orderId: 'order-1' },
      requestChargeRu: 1.23,
      etag: undefined,
    });
  });

  it('queryItems runs SQL with optional partition key scope', async () => {
    const fetchAll = jest
      .fn()
      .mockResolvedValue({ resources: [{ id: 'a' }], requestCharge: 2.5 });
    mockContainer.items.query.mockReturnValue({ fetchAll });

    const querySpec = {
      query: 'SELECT * FROM c WHERE c.orderId = @orderId',
      parameters: [{ name: '@orderId', value: 'order-1' }],
    };

    await expect(service.queryItems(querySpec, 'order-1')).resolves.toEqual([
      { id: 'a' },
    ]);

    expect(mockContainer.items.query).toHaveBeenCalledWith(querySpec, {
      partitionKey: 'order-1',
    });
  });

  it('queryItemsWithCharge returns resources and RU', async () => {
    const fetchAll = jest.fn().mockResolvedValue({
      resources: [{ id: 'a' }],
      requestCharge: 3.3,
    });
    mockContainer.items.query.mockReturnValue({ fetchAll });

    await expect(
      service.queryItemsWithCharge({ query: 'SELECT * FROM c' }),
    ).resolves.toEqual({
      resources: [{ id: 'a' }],
      requestChargeRu: 3.3,
    });
  });
});
