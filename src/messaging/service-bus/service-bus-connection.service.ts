import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceBusClient } from '@azure/service-bus';
import type { AppConfiguration } from '../../config/configuration';

@Injectable()
export class ServiceBusConnectionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ServiceBusConnectionService.name);
  private client: ServiceBusClient | undefined;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {}

  onModuleInit(): void {
    const serviceBus = this.configService.get('serviceBus', { infer: true });
    this.logger.log(
      `Service Bus configured for namespace "${serviceBus.namespace}"`,
    );
  }

  getClient(): ServiceBusClient {
    if (!this.client) {
      const serviceBus = this.configService.get('serviceBus', { infer: true });
      this.client = new ServiceBusClient(serviceBus.connectionString);
    }
    return this.client;
  }

  getOrdersQueueName(): string {
    return this.configService.get('serviceBus', { infer: true }).ordersQueue;
  }

  isConsumerEnabled(): boolean {
    return this.configService.get('serviceBus', { infer: true })
      .consumerEnabled;
  }

  shouldSimulateTransientFailure(): boolean {
    return this.configService.get('serviceBus', { infer: true })
      .simulateTransientFailure;
  }

  getSubscribeOptions(): { prefetchCount: number; maxConcurrentCalls: number } {
    const serviceBus = this.configService.get('serviceBus', { infer: true });
    return {
      prefetchCount: serviceBus.prefetchCount,
      maxConcurrentCalls: serviceBus.maxConcurrentCalls,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
  }
}
