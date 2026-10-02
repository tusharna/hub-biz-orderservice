import { Logger } from '@nestjs/common';
import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import { isEventEnvelope } from '../events/event-envelope.validation';

/** Thrown for failures that should release the peek-lock so Service Bus redelivers. */
export class TransientMessageProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientMessageProcessingError';
  }
}

export interface MessageSettlement {
  completeMessage(message: ServiceBusReceivedMessage): Promise<void>;
  abandonMessage(message: ServiceBusReceivedMessage): Promise<void>;
}

export type SettlementResult = 'completed' | 'abandoned';

export function isTransientFailureSimulationEnabled(options: {
  nodeEnv: string;
  simulateFlag: boolean;
}): boolean {
  return options.nodeEnv !== 'production' && options.simulateFlag;
}

function messageIdText(
  messageId: ServiceBusReceivedMessage['messageId'],
): string {
  if (messageId === undefined || messageId === null) {
    return '(no messageId)';
  }
  return String(messageId);
}

function readEventType(body: unknown): string {
  if (isEventEnvelope(body)) {
    return body.eventType;
  }
  return 'unknown';
}

function readCorrelationId(message: ServiceBusReceivedMessage): string {
  if (typeof message.correlationId === 'string' && message.correlationId) {
    return message.correlationId;
  }
  if (isEventEnvelope(message.body)) {
    return message.body.correlationId;
  }
  return '';
}

/** Logs the fields needed to follow peek-lock delivery and redelivery. */
export function logReceivedMessageContext(
  message: ServiceBusReceivedMessage,
  logger: Logger,
): void {
  logger.log(
    JSON.stringify({
      messageId: messageIdText(message.messageId),
      deliveryCount: message.deliveryCount ?? 0,
      correlationId: readCorrelationId(message),
      eventType: readEventType(message.body),
    }),
  );
}

/**
 * Peek-lock settlement:
 * success -> complete (removed from the queue)
 * transient failure -> abandon (lock released, deliveryCount increments on next receive)
 */
export async function settleAfterProcessing(
  message: ServiceBusReceivedMessage,
  settlement: MessageSettlement,
  outcome: 'success' | 'transient-failure',
  logger: Logger,
): Promise<SettlementResult> {
  const id = messageIdText(message.messageId);
  if (outcome === 'success') {
    await settlement.completeMessage(message);
    logger.log(`Completed message ${id}`);
    return 'completed';
  }

  await settlement.abandonMessage(message);
  logger.warn(
    `Abandoned message ${id} for redelivery (deliveryCount=${message.deliveryCount ?? 0})`,
  );
  return 'abandoned';
}
