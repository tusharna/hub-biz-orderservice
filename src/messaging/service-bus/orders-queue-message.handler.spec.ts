import { Logger } from '@nestjs/common';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import { ORDER_CREATED_EVENT_TYPE } from '../events/event-types.constants';
import { handleOrdersQueueMessage } from './orders-queue-message.handler';

describe('handleOrdersQueueMessage', () => {
  it('logs OrderCreated envelope fields', () => {
    const log = jest.fn();
    const warn = jest.fn();
    const logger = { log, warn } as unknown as Logger;

    handleOrdersQueueMessage(
      {
        body: {
          eventId: 'evt-1',
          eventType: ORDER_CREATED_EVENT_TYPE,
          version: 1,
          occurredAt: '2026-09-20T10:00:00.000Z',
          correlationId: 'order-1',
          data: {
            orderId: 'order-1',
            userId: 'user-100',
            status: OrderStatus.PENDING,
            totalAmount: 1000,
            itemCount: 1,
            items: [{ productId: 'p1', quantity: 2 }],
          },
        },
        messageId: 'msg-1',
        correlationId: 'order-1',
      } as never,
      logger,
    );

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('order-1'));
  });
});
