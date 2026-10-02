import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { CosmosConcurrencyLearningController } from './cosmos-concurrency-learning.controller';

@Module({
  imports: [OrdersModule],
  controllers: [CosmosConcurrencyLearningController],
})
export class CosmosConcurrencyLearningModule {}
