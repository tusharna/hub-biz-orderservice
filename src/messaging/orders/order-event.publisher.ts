import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Order } from '../../orders/domain/order.types';
import { ORDER_CREATED_EVENT_TYPE } from '../events/event-types.constants';
import { buildOrderCreatedEvent } from '../events/order-created.event.factory';
import {
  MESSAGE_PRODUCER,
  type MessageProducer,
} from '../producer/message-producer.interface';
import { ServiceBusConnectionService } from '../service-bus/service-bus-connection.service';

@Injectable()
export class OrderEventPublisher {
  private readonly logger = new Logger(OrderEventPublisher.name);

  constructor(
    @Inject(MESSAGE_PRODUCER)
    private readonly messageProducer: MessageProducer,
    private readonly serviceBusConnection: ServiceBusConnectionService,
  ) {}

  async publishOrderCreated(order: Order): Promise<void> {
    const envelope = buildOrderCreatedEvent(order);
    const queueName = this.serviceBusConnection.getOrdersQueueName();

    await this.messageProducer.sendToQueue(queueName, envelope, {
      correlationId: envelope.correlationId,
      contentType: 'application/json',
    });

    this.logger.log(
      `Published ${ORDER_CREATED_EVENT_TYPE} eventId=${envelope.eventId} orderId=${order.orderId} queue=${queueName}`,
    );
  }
}
