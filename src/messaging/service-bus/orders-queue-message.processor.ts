import { Logger } from '@nestjs/common';
import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import { handleOrdersQueueMessage } from './orders-queue-message.handler';
import {
  logReceivedMessageContext,
  settleAfterProcessing,
  TransientMessageProcessingError,
  type MessageSettlement,
  type SettlementResult,
} from './message-settlement';

export async function processOrdersQueueMessage(
  message: ServiceBusReceivedMessage,
  settlement: MessageSettlement,
  options: { simulateTransientFailure: boolean },
  logger: Logger,
): Promise<SettlementResult> {
  logReceivedMessageContext(message, logger);

  try {
    if (options.simulateTransientFailure) {
      logger.warn(
        'Development failure switch is on; treating this delivery as a transient failure.',
      );
      throw new TransientMessageProcessingError(
        'Simulated transient processing failure',
      );
    }

    handleOrdersQueueMessage(message, logger);
    return await settleAfterProcessing(message, settlement, 'success', logger);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Order message processing failed: ${detail}`);
    return settleAfterProcessing(
      message,
      settlement,
      'transient-failure',
      logger,
    );
  }
}
