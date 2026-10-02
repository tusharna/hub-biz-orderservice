import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from './domain/order-status.enum';
import type { Order } from './domain/order.types';
import { OrderConcurrencyConflictException } from './exceptions/order-concurrency-conflict.exception';
import { OrderService } from './order.service';
import {
  ORDER_REPOSITORY,
  type OrderRepository,
} from './repositories/order.repository';

describe('OrderService', () => {
  let service: OrderService;
  let repository: jest.Mocked<OrderRepository>;

  const sampleOrder: Order = {
    id: 'order-1',
    type: 'order',
    orderId: 'order-1',
    userId: 'user-100',
    status: OrderStatus.PENDING,
    items: [{ productId: 'product-100', quantity: 2, price: 500 }],
    totalAmount: 1000,
    createdAt: '2026-09-20T10:00:00.000Z',
    updatedAt: '2026-09-20T10:00:00.000Z',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findByOrderId: jest.fn(),
      findByOrderIdWithEtag: jest.fn(),
      replace: jest.fn(),
      replaceIfMatch: jest.fn(),
      createWithOutbox: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: ORDER_REPOSITORY, useValue: repository },
      ],
    }).compile();

    service = module.get(OrderService);
  });

  describe('createOrder', () => {
    it('calculates totalAmount and writes order plus outbox in one batch', async () => {
      repository.createWithOutbox.mockImplementation((order: Order) =>
        Promise.resolve(order),
      );

      const result = await service.createOrder({
        userId: 'user-100',
        items: [{ productId: 'product-100', quantity: 2, price: 500 }],
      });

      expect(result.totalAmount).toBe(1000);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(repository.createWithOutbox.mock.calls).toHaveLength(1);
      const outbox = repository.createWithOutbox.mock.calls[0]?.[1];
      expect(outbox?.type).toBe('outbox');
      expect(outbox?.orderId).toBe(result.orderId);
      expect(outbox?.status).toBe('PENDING');
    });
  });

  describe('getOrderWithEtag', () => {
    it('returns order and etag when found', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue({
        order: sampleOrder,
        etag: 'etag-v1',
      });
      await expect(service.getOrderWithEtag('order-1')).resolves.toEqual({
        order: sampleOrder,
        etag: 'etag-v1',
      });
    });

    it('throws when order is missing', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue(null);
      await expect(service.getOrder('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateOrderStatusIfMatch', () => {
    it('updates status via replaceIfMatch', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue({
        order: sampleOrder,
        etag: 'etag-v1',
      });
      repository.replaceIfMatch.mockResolvedValue({
        order: { ...sampleOrder, status: OrderStatus.PROCESSING },
        etag: 'etag-v2',
      });

      const result = await service.updateOrderStatusIfMatch(
        'order-1',
        OrderStatus.PROCESSING,
        'etag-v1',
      );

      expect(result.etag).toBe('etag-v2');
      expect(result.order.status).toBe(OrderStatus.PROCESSING);
      expect(repository.replaceIfMatch.mock.calls[0]?.[1]).toBe('etag-v1');
    });

    it('maps repository conflict to OrderConcurrencyConflictException', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue({
        order: sampleOrder,
        etag: 'etag-v1',
      });
      repository.replaceIfMatch.mockRejectedValue(
        new OrderConcurrencyConflictException('order-1'),
      );

      await expect(
        service.updateOrderStatusIfMatch(
          'order-1',
          OrderStatus.PROCESSING,
          'etag-v1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('simulateConcurrentStatusUpdates', () => {
    it('first writer succeeds and second writer with same etag fails', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue({
        order: sampleOrder,
        etag: 'etag-shared',
      });
      repository.replaceIfMatch
        .mockResolvedValueOnce({
          order: { ...sampleOrder, status: OrderStatus.PROCESSING },
          etag: 'etag-new',
        })
        .mockRejectedValueOnce(
          new OrderConcurrencyConflictException('order-1'),
        );

      const result = await service.simulateConcurrentStatusUpdates(
        'order-1',
        'etag-shared',
        OrderStatus.PROCESSING,
        OrderStatus.PAID,
      );

      expect(result.firstWriter.order.status).toBe(OrderStatus.PROCESSING);
      expect(result.secondWriterError).toBeInstanceOf(
        OrderConcurrencyConflictException,
      );
      expect(repository.replaceIfMatch.mock.calls[1]?.[1]).toBe('etag-shared');
    });
  });

  describe('updateOrderStatus', () => {
    it('reads etag then performs conditional replace', async () => {
      repository.findByOrderIdWithEtag.mockResolvedValue({
        order: sampleOrder,
        etag: 'etag-v1',
      });
      repository.replaceIfMatch.mockResolvedValue({
        order: { ...sampleOrder, status: OrderStatus.PROCESSING },
        etag: 'etag-v2',
      });

      const result = await service.updateOrderStatus(
        'order-1',
        OrderStatus.PROCESSING,
      );

      expect(result.status).toBe(OrderStatus.PROCESSING);
      expect(repository.replaceIfMatch.mock.calls[0]?.[1]).toBe('etag-v1');
    });
  });
});
