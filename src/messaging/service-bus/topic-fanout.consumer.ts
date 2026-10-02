import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServiceBusReceiver } from '@azure/service-bus';
import type { AppConfiguration } from '../../config/configuration';
import { claimProcessedEvent } from '../../idempotency/claim-processed-event';
import { CosmosService } from '../../cosmos/cosmos.service';
import { isEventEnvelope } from '../events/event-envelope.validation';
import { MetricsService } from '../../observability/metrics.service';
import { ServiceBusConnectionService } from './service-bus-connection.service';

const SUBSCRIPTION_BY_ROLE: Record<string, string> = {
  'payment-service': 'payment-subscription',
  'notification-service': 'notification-subscription',
};

@Injectable()
export class TopicFanoutConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TopicFanoutConsumer.name);
  private receiver: ServiceBusReceiver | undefined;
  private subscription: ReturnType<ServiceBusReceiver['subscribe']> | undefined;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
    private readonly cosmosService: CosmosService,
    private readonly metrics: MetricsService,
    private readonly serviceBusConnection: ServiceBusConnectionService,
  ) {}

  onModuleInit(): void {
    const serviceBus = this.configService.get('serviceBus', { infer: true });
    if (serviceBus.appRole === 'inventory-service') {
      this.logger.log(
        'Inventory subscription is owned by the separate inventory app.',
      );
      return;
    }
    const subscriptionName = SUBSCRIPTION_BY_ROLE[serviceBus.appRole];
    if (!subscriptionName || !serviceBus.ordersTopic) {
      return;
    }
    this.receiver = this.serviceBusConnection
      .getClient()
      .createReceiver(serviceBus.ordersTopic, subscriptionName);
    const receiver = this.receiver;
    this.subscription = receiver.subscribe(
      {
        processMessage: async (message) => {
          this.metrics.increment('messagesReceived');
          const body: unknown = message.body;
          const eventType = isEventEnvelope(body) ? body.eventType : 'unknown';
          const eventId = isEventEnvelope(body)
            ? body.eventId
            : String(message.messageId ?? '');
          const orderId = isEventEnvelope(body) ? readOrderId(body.data) : '';
          this.logger.log(
            JSON.stringify({
              service: serviceBus.appRole,
              messageId:
                message.messageId == null ? '' : String(message.messageId),
              eventId,
              correlationId: message.correlationId ?? '',
              orderId,
              eventType,
              timestamp: new Date().toISOString(),
            }),
          );
          if (orderId && eventId) {
            const claim = await claimProcessedEvent({
              consumer: serviceBus.appRole,
              eventId,
              orderId,
              ttlSeconds: serviceBus.processedEventTtlSeconds,
              tryCreate: async (document) => {
                await this.cosmosService.createItem(document);
              },
              isConflict: (error) =>
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                (error as { code?: number }).code === 409,
            });
            if (claim === 'duplicate') {
              this.metrics.increment('duplicateEvents');
            }
          }
          await receiver.completeMessage(message);
          this.metrics.increment('messagesCompleted');
        },
        processError: (args) => {
          this.logger.error(args.error.message);
          return Promise.resolve();
        },
      },
      { autoCompleteMessages: false },
    );
    this.logger.log(
      `Fan-out consumer listening on ${serviceBus.ordersTopic}/${subscriptionName}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscription?.close();
    await this.receiver?.close();
  }
}

function readOrderId(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'orderId' in data) {
    const orderId = (data as { orderId?: unknown }).orderId;
    return typeof orderId === 'string' ? orderId : '';
  }
  return '';
}
