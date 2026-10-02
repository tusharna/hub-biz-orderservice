import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { CosmosModule } from './cosmos/cosmos.module';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { CosmosAccessPatternsModule } from './learning/cosmos-access-patterns/cosmos-access-patterns.module';
import { CosmosConcurrencyLearningModule } from './learning/cosmos-concurrency/cosmos-concurrency-learning.module';

import { ServiceBusModule } from './messaging/service-bus/service-bus.module';
import { AdminModule } from './admin/admin.module';
import { OutboxModule } from './outbox/outbox.module';
import { ObservabilityModule } from './observability/observability.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    AppConfigModule,
    CosmosModule,
    ServiceBusModule,
    ObservabilityModule,
    CacheModule,
    HealthModule,
    OrdersModule,
    AdminModule,
    OutboxModule,
    CosmosAccessPatternsModule,
    CosmosConcurrencyLearningModule,
  ],
})
export class AppModule {}
