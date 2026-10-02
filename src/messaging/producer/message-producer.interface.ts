export interface MessageSendMetadata {
  correlationId?: string;
  contentType?: string;
  messageId?: string;
  sessionId?: string;
  applicationProperties?: Record<string, string | number | boolean>;
  scheduledEnqueueTimeUtc?: Date;
}

/** Port for sending integration events to Azure Service Bus queues. */
export interface MessageProducer {
  sendToQueue(
    queueName: string,
    body: unknown,
    metadata?: MessageSendMetadata,
  ): Promise<void>;
  send(
    entityName: string,
    body: unknown,
    metadata?: MessageSendMetadata,
  ): Promise<void>;
}

export const MESSAGE_PRODUCER = Symbol('MESSAGE_PRODUCER');
