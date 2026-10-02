import { Logger } from '@nestjs/common';
import type { ServiceBusReceivedMessage } from '@azure/service-bus';
import { isOrderCreatedEnvelope } from '../events/event-envelope.validation';

export function handleOrdersQueueMessage(
  message: ServiceBusReceivedMessage,
  logger: Logger = new Logger('OrdersQueueConsumer'),
): void {
  const body: unknown = message.body;

  if (!isOrderCreatedEnvelope(body)) {
    const messageIdText =
      message.messageId === undefined || message.messageId === null
        ? '(no messageId)'
        : String(message.messageId);
    logger.warn(
      `Ignoring message ${messageIdText}: unrecognized envelope shape or eventType`,
    );
    return;
  }

  logger.log(
    JSON.stringify({
      messageId: message.messageId,
      deliveryCount: message.deliveryCount ?? 0,
      correlationId: message.correlationId ?? body.correlationId,
      eventType: body.eventType,
      eventId: body.eventId,
      orderId: body.data.orderId,
      userId: body.data.userId,
      status: body.data.status,
      totalAmount: body.data.totalAmount,
      itemCount: body.data.itemCount,
    }),
  );
}
