import { Controller, Get } from '@nestjs/common';
import { ServiceBusConnectionService } from '../messaging/service-bus/service-bus-connection.service';

@Controller('admin/dead-letter-messages')
export class DeadLetterController {
  constructor(
    private readonly serviceBusConnection: ServiceBusConnectionService,
  ) {}

  @Get()
  async list() {
    const queueName = this.serviceBusConnection.getOrdersQueueName();
    const receiver = this.serviceBusConnection
      .getClient()
      .createReceiver(queueName, { subQueueType: 'deadLetter' });
    try {
      const messages = await receiver.peekMessages(20);
      return {
        queue: queueName,
        count: messages.length,
        messages: messages.map((message) => ({
          messageId: message.messageId,
          correlationId: message.correlationId,
          deliveryCount: message.deliveryCount,
          deadLetterReason: message.deadLetterReason,
          deadLetterErrorDescription: message.deadLetterErrorDescription,
          enqueuedTimeUtc: message.enqueuedTimeUtc,
          eventType:
            typeof message.body === 'object' &&
            message.body !== null &&
            'eventType' in message.body
              ? (message.body as { eventType?: unknown }).eventType
              : undefined,
        })),
      };
    } finally {
      await receiver.close();
    }
  }
}
