import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { ServiceBusSender } from '@azure/service-bus';
import type {
  MessageProducer,
  MessageSendMetadata,
} from '../producer/message-producer.interface';
import { ServiceBusConnectionService } from './service-bus-connection.service';

function readEventType(body: unknown): string | undefined {
  if (
    typeof body === 'object' &&
    body !== null &&
    'eventType' in body &&
    typeof body.eventType === 'string'
  ) {
    return body.eventType;
  }
  return undefined;
}

@Injectable()
export class AzureServiceBusMessageProducer
  implements MessageProducer, OnModuleDestroy
{
  private readonly senders = new Map<string, ServiceBusSender>();

  constructor(
    private readonly serviceBusConnection: ServiceBusConnectionService,
  ) {}

  async sendToQueue(
    queueName: string,
    body: unknown,
    metadata?: MessageSendMetadata,
  ): Promise<void> {
    await this.send(queueName, body, metadata);
  }

  /** Queue and topic sends both use ServiceBusSender.sendMessages. */
  async send(
    entityName: string,
    body: unknown,
    metadata?: MessageSendMetadata,
  ): Promise<void> {
    const sender = this.getOrCreateSender(entityName);
    const eventType = readEventType(body);
    const message = {
      body,
      contentType: metadata?.contentType ?? 'application/json',
      correlationId: metadata?.correlationId,
      messageId: metadata?.messageId,
      sessionId: metadata?.sessionId,
      applicationProperties: {
        ...(eventType ? { eventType } : {}),
        ...metadata?.applicationProperties,
      },
    };
    if (metadata?.scheduledEnqueueTimeUtc) {
      await sender.scheduleMessages(message, metadata.scheduledEnqueueTimeUtc);
      return;
    }
    await sender.sendMessages(message);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.senders.values()].map((sender) => sender.close()),
    );
    this.senders.clear();
  }

  private getOrCreateSender(queueName: string): ServiceBusSender {
    let sender = this.senders.get(queueName);
    if (!sender) {
      sender = this.serviceBusConnection.getClient().createSender(queueName);
      this.senders.set(queueName, sender);
    }
    return sender;
  }
}
