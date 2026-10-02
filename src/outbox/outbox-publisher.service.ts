import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ChangeFeedStartFrom } from '@azure/cosmos';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration';
import { CosmosService } from '../cosmos/cosmos.service';
import {
  MESSAGE_PRODUCER,
  type MessageProducer,
} from '../messaging/producer/message-producer.interface';
import { OUTBOX_CHECKPOINT_ID, type OutboxEventDocument } from './outbox.types';
import { publishOutboxDocument } from './outbox-publish';
import { MetricsService } from '../observability/metrics.service';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly cosmosService: CosmosService,
    private readonly configService: ConfigService<AppConfiguration, true>,
    @Inject(MESSAGE_PRODUCER)
    private readonly messageProducer: MessageProducer,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get('serviceBus', {
      infer: true,
    }).outboxPublisherEnabled;
    if (!enabled) {
      this.logger.log('Outbox publisher is disabled.');
      return;
    }
    this.timer = setInterval(() => {
      void this.poll();
    }, 5000);
    void this.poll();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async poll(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const pending = await this.cosmosService.queryItems({
        query:
          "SELECT * FROM c WHERE c.type = 'outbox' AND c.status = 'PENDING'",
      });
      for (const document of pending) {
        await this.publishOne(document as unknown as OutboxEventDocument);
      }

      const checkpoint = await this.readCheckpoint();
      const iterator = this.cosmosService
        .getOrdersContainer()
        .items.getChangeFeedIterator({
          changeFeedStartFrom: checkpoint
            ? ChangeFeedStartFrom.Continuation(checkpoint)
            : ChangeFeedStartFrom.Now(),
          maxItemCount: 20,
        });
      const page = await iterator.readNext();
      const documents = page.result ?? [];
      for (const resource of documents) {
        const record = resource as { type?: string };
        if (record.type === 'outbox') {
          await this.publishOne(resource as unknown as OutboxEventDocument);
        }
      }
      if (page.continuationToken) {
        await this.writeCheckpoint(page.continuationToken);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Outbox publisher poll failed: ${message}`);
      this.metrics.increment('outboxPublishFailures');
    } finally {
      this.running = false;
    }
  }

  async publishOne(document: OutboxEventDocument): Promise<void> {
    if (document.status === 'PUBLISHED') {
      return;
    }
    const started = Date.now();
    const entity = this.configService.get('serviceBus', {
      infer: true,
    }).publishEntityName;
    const envelope = document.payload;
    const result = await publishOutboxDocument(document, () =>
      this.messageProducer.send(entity, envelope, {
        messageId: document.eventId,
        correlationId: document.correlationId,
        sessionId: this.configService.get('serviceBus', { infer: true })
          .sessionsEnabled
          ? document.orderId
          : undefined,
      }),
    );
    await this.cosmosService.replaceItem(result.document);
    this.metrics.observe('outboxPublishLatencyMs', Date.now() - started);
    if (result.status === 'published') {
      this.logger.log(
        JSON.stringify({
          eventId: document.eventId,
          orderId: document.orderId,
          correlationId: document.correlationId,
          status: 'published',
        }),
      );
      return;
    }
    this.metrics.increment('outboxPublishFailures');
    this.logger.warn(
      `Outbox event ${document.eventId} remains unpublished after attempt ${result.document.attempts}`,
    );
  }

  private async readCheckpoint(): Promise<string | undefined> {
    const document = await this.cosmosService.readItemById(
      OUTBOX_CHECKPOINT_ID,
      OUTBOX_CHECKPOINT_ID,
    );
    const token = document?.['continuationToken'];
    return typeof token === 'string' ? token : undefined;
  }

  private async writeCheckpoint(continuationToken: string): Promise<void> {
    const body = {
      id: OUTBOX_CHECKPOINT_ID,
      type: 'checkpoint',
      orderId: OUTBOX_CHECKPOINT_ID,
      continuationToken,
    };
    const existing = await this.cosmosService.readItemById(
      OUTBOX_CHECKPOINT_ID,
      OUTBOX_CHECKPOINT_ID,
    );
    if (existing) {
      await this.cosmosService.replaceItem(body);
      return;
    }
    await this.cosmosService.createItem(body);
  }
}
