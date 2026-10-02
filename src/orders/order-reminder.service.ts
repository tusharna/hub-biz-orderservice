import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration';
import { buildOrderCreatedEvent } from '../messaging/events/order-created.event.factory';
import {
  MESSAGE_PRODUCER,
  type MessageProducer,
} from '../messaging/producer/message-producer.interface';
import { OrderService } from './order.service';

@Injectable()
export class OrderReminderService {
  constructor(
    private readonly orderService: OrderService,
    private readonly configService: ConfigService<AppConfiguration, true>,
    @Inject(MESSAGE_PRODUCER)
    private readonly messageProducer: MessageProducer,
  ) {}

  async scheduleReminder(orderId: string): Promise<{
    orderId: string;
    scheduledEnqueueTimeUtc: string;
    correlationId: string;
  }> {
    const order = await this.orderService.getOrder(orderId);
    const delaySeconds = Number(
      process.env.ORDER_REMINDER_DELAY_SECONDS ?? '15',
    );
    const when = new Date(Date.now() + delaySeconds * 1000);
    const envelope = buildOrderCreatedEvent(order, order.orderId);
    envelope.eventType = 'OrderReminder';
    const entity = this.configService.get('serviceBus', {
      infer: true,
    }).publishEntityName;
    await this.messageProducer.send(entity, envelope, {
      correlationId: order.orderId,
      messageId: envelope.eventId,
      scheduledEnqueueTimeUtc: when,
      applicationProperties: { notificationType: 'email' },
    });
    return {
      orderId: order.orderId,
      scheduledEnqueueTimeUtc: when.toISOString(),
      correlationId: order.orderId,
    };
  }
}
