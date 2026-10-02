import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ServiceBusReceiver } from '@azure/service-bus';
import { processOrdersQueueMessage } from './orders-queue-message.processor';
import type { MessageSettlement } from './message-settlement';
import { ServiceBusConnectionService } from './service-bus-connection.service';

@Injectable()
export class OrdersQueueConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersQueueConsumer.name);
  private receiver: ServiceBusReceiver | undefined;
  private subscription: ReturnType<ServiceBusReceiver['subscribe']> | undefined;

  constructor(
    private readonly serviceBusConnection: ServiceBusConnectionService,
  ) {}

  onModuleInit(): void {
    if (!this.serviceBusConnection.isConsumerEnabled()) {
      this.logger.log('Orders queue consumer is disabled by configuration.');
      return;
    }

    const queueName = this.serviceBusConnection.getOrdersQueueName();
    // Default receive mode is peek-lock; set it explicitly so settlement is visible.
    this.receiver = this.serviceBusConnection
      .getClient()
      .createReceiver(queueName, { receiveMode: 'peekLock' });

    const receiver = this.receiver;
    const settlement: MessageSettlement = {
      completeMessage: (message) => receiver.completeMessage(message),
      abandonMessage: (message) => receiver.abandonMessage(message),
    };

    this.subscription = this.receiver.subscribe(
      {
        processMessage: async (message) => {
          await processOrdersQueueMessage(
            message,
            settlement,
            {
              simulateTransientFailure:
                this.serviceBusConnection.shouldSimulateTransientFailure(),
            },
            this.logger,
          );
        },
        processError: (args) => {
          this.logger.error(
            `Orders queue consumer error (entity=${args.entityPath}): ${args.error.message}`,
            args.error.stack,
          );
          return Promise.resolve();
        },
      },
      {
        autoCompleteMessages: false,
        ...this.serviceBusConnection.getSubscribeOptions(),
      },
    );

    this.logger.log(
      `Listening on Service Bus queue "${queueName}" (peek-lock)`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscription?.close();
    await this.receiver?.close();
    this.receiver = undefined;
    this.subscription = undefined;
  }
}
