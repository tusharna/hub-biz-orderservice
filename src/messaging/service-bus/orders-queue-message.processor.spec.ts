import { Logger } from '@nestjs/common';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import { ORDER_CREATED_EVENT_TYPE } from '../events/event-types.constants';
import {
  isTransientFailureSimulationEnabled,
  type MessageSettlement,
} from './message-settlement';
import { processOrdersQueueMessage } from './orders-queue-message.processor';

function orderCreatedMessage(deliveryCount: number) {
  return {
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
    deliveryCount,
  };
}

describe('message settlement', () => {
  it('enables the failure switch only outside production', () => {
    expect(
      isTransientFailureSimulationEnabled({
        nodeEnv: 'development',
        simulateFlag: true,
      }),
    ).toBe(true);
    expect(
      isTransientFailureSimulationEnabled({
        nodeEnv: 'production',
        simulateFlag: true,
      }),
    ).toBe(false);
    expect(
      isTransientFailureSimulationEnabled({
        nodeEnv: 'development',
        simulateFlag: false,
      }),
    ).toBe(false);
  });
});

describe('processOrdersQueueMessage', () => {
  function createHarness() {
    const completeMessage = jest
      .fn<MessageSettlement['completeMessage']>()
      .mockResolvedValue(undefined);
    const abandonMessage = jest
      .fn<MessageSettlement['abandonMessage']>()
      .mockResolvedValue(undefined);
    const log = jest.fn();
    const warn = jest.fn();
    const logger = { log, warn } as unknown as Logger;
    return {
      settlement: { completeMessage, abandonMessage },
      logger,
      log,
      warn,
    };
  }

  it('completes after a successful OrderCreated log', async () => {
    const { settlement, logger, log } = createHarness();
    const message = orderCreatedMessage(1);

    await expect(
      processOrdersQueueMessage(
        message as never,
        settlement,
        { simulateTransientFailure: false },
        logger,
      ),
    ).resolves.toBe('completed');

    expect(settlement.completeMessage).toHaveBeenCalledWith(message);
    expect(settlement.abandonMessage).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"deliveryCount":1'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"eventType":"OrderCreated"'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"messageId":"msg-1"'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"correlationId":"order-1"'),
    );
  });

  it('abandons when the development failure switch is on', async () => {
    const { settlement, logger } = createHarness();
    const message = orderCreatedMessage(2);

    await expect(
      processOrdersQueueMessage(
        message as never,
        settlement,
        { simulateTransientFailure: true },
        logger,
      ),
    ).resolves.toBe('abandoned');

    expect(settlement.abandonMessage).toHaveBeenCalledWith(message);
    expect(settlement.completeMessage).not.toHaveBeenCalled();
  });
});
