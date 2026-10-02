import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { OrderStatus } from '../src/orders/domain/order-status.enum';
import type { Order } from '../src/orders/domain/order.types';
import { OrderConcurrencyConflictException } from '../src/orders/exceptions/order-concurrency-conflict.exception';
import { OrderService } from '../src/orders/order.service';
import { CosmosService } from '../src/cosmos/cosmos.service';

describe('Orders API (e2e)', () => {
  let app: INestApplication<App>;
  let orderService: {
    createOrder: jest.Mock;
    getOrderWithEtag: jest.Mock;
    toOrderResponse: OrderService['toOrderResponse'];
    updateOrderStatusIfMatch: jest.Mock;
    simulateConcurrentStatusUpdates: jest.Mock;
  };

  const order: Order = {
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
    orderService = {
      createOrder: jest.fn(),
      getOrderWithEtag: jest.fn(),
      toOrderResponse: (withEtag) => ({
        ...withEtag.order,
        etag: withEtag.etag,
      }),
      updateOrderStatusIfMatch: jest.fn(),
      simulateConcurrentStatusUpdates: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CosmosService)
      .useValue({
        checkHealth: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(OrderService)
      .useValue(orderService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /orders returns 201 with created order', () => {
    orderService.createOrder.mockResolvedValue(order);

    return request(app.getHttpServer())
      .post('/orders')
      .send({
        userId: 'user-100',
        items: [{ productId: 'product-100', quantity: 2, price: 500 }],
      })
      .expect(201)
      .expect(order);
  });

  it('POST /orders returns 400 for invalid body', () => {
    return request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 'user-100', items: [] })
      .expect(400);
  });

  it('GET /orders/:id returns 200 with etag', () => {
    orderService.getOrderWithEtag.mockResolvedValue({
      order,
      etag: 'etag-v1',
    });

    return request(app.getHttpServer())
      .get('/orders/order-1')
      .expect(200)
      .expect({ ...order, etag: 'etag-v1' });
  });

  it('GET /orders/:id returns 404 when missing', () => {
    orderService.getOrderWithEtag.mockRejectedValue(
      new NotFoundException('Order not found: missing'),
    );

    return request(app.getHttpServer()).get('/orders/missing').expect(404);
  });

  it('PATCH /orders/:id/status returns 409 on etag conflict', () => {
    orderService.updateOrderStatusIfMatch.mockRejectedValue(
      new OrderConcurrencyConflictException('order-1'),
    );

    return request(app.getHttpServer())
      .patch('/orders/order-1/status')
      .send({ status: OrderStatus.PROCESSING, etag: 'stale-etag' })
      .expect(409);
  });
});
