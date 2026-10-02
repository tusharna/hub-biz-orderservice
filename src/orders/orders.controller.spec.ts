import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from './domain/order-status.enum';
import type { Order } from './domain/order.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderReminderService } from './order-reminder.service';
import { OrderService } from './order.service';
import { OrdersController } from './orders.controller';

describe('OrdersController', () => {
  let controller: OrdersController;
  let orderService: jest.Mocked<
    Pick<
      OrderService,
      | 'createOrder'
      | 'getOrderWithEtag'
      | 'toOrderResponse'
      | 'updateOrderStatusIfMatch'
    >
  >;

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
      toOrderResponse: jest.fn((withEtag) => ({
        ...withEtag.order,
        etag: withEtag.etag,
      })),
      updateOrderStatusIfMatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrderService, useValue: orderService },
        {
          provide: OrderReminderService,
          useValue: { scheduleReminder: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(OrdersController);
  });

  it('POST createOrder delegates to OrderService', async () => {
    const dto: CreateOrderDto = {
      userId: 'user-100',
      items: [{ productId: 'product-100', quantity: 2, price: 500 }],
    };
    orderService.createOrder.mockResolvedValue(order);

    await expect(controller.createOrder(dto)).resolves.toEqual(order);
    expect(orderService.createOrder).toHaveBeenCalledWith(dto);
  });

  it('GET getOrder returns order with etag', async () => {
    orderService.getOrderWithEtag.mockResolvedValue({
      order,
      etag: 'etag-v1',
    });

    await expect(controller.getOrder('order-1')).resolves.toEqual({
      ...order,
      etag: 'etag-v1',
    });
  });

  it('PATCH updateOrderStatus delegates with etag', async () => {
    const dto: UpdateOrderStatusDto = {
      status: OrderStatus.PROCESSING,
      etag: 'etag-v1',
    };
    orderService.updateOrderStatusIfMatch.mockResolvedValue({
      order: { ...order, status: OrderStatus.PROCESSING },
      etag: 'etag-v2',
    });

    await expect(controller.updateOrderStatus('order-1', dto)).resolves.toEqual(
      {
        ...order,
        status: OrderStatus.PROCESSING,
        etag: 'etag-v2',
      },
    );
    expect(orderService.updateOrderStatusIfMatch).toHaveBeenCalledWith(
      'order-1',
      OrderStatus.PROCESSING,
      'etag-v1',
    );
  });

  it('GET getOrder propagates NotFoundException', async () => {
    orderService.getOrderWithEtag.mockRejectedValue(
      new NotFoundException('Order not found: missing'),
    );
    await expect(controller.getOrder('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
