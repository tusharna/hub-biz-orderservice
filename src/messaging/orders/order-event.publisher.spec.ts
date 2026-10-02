import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import type { Order } from '../../orders/domain/order.types';
import { ORDER_CREATED_EVENT_TYPE } from '../events/event-types.constants';
import {
  MESSAGE_PRODUCER,
  type MessageProducer,
} from '../producer/message-producer.interface';
import { OrderEventPublisher } from './order-event.publisher';
import { ServiceBusConnectionService } from '../service-bus/service-bus-connection.service';

describe('OrderEventPublisher', () => {
  let publisher: OrderEventPublisher;
  let messageProducer: jest.Mocked<MessageProducer>;

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
    messageProducer = { sendToQueue: jest.fn(), send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderEventPublisher,
        {
          provide: MESSAGE_PRODUCER,
          useValue: messageProducer,
        },
        {
          provide: ServiceBusConnectionService,
          useValue: { getOrdersQueueName: () => 'orders-queue' },
        },
      ],
    }).compile();

    publisher = module.get(OrderEventPublisher);
  });

  it('sends OrderCreated envelope to orders-queue', async () => {
    await publisher.publishOrderCreated(order);

    expect(messageProducer.sendToQueue.mock.calls).toHaveLength(1);
    const call = messageProducer.sendToQueue.mock.calls[0];
    expect(call?.[0]).toBe('orders-queue');
    expect(call?.[1]).toMatchObject({
      eventType: ORDER_CREATED_EVENT_TYPE,
      correlationId: 'order-1',
      data: { orderId: 'order-1' },
    });
    expect(call?.[2]?.correlationId).toBe('order-1');
  });
});
