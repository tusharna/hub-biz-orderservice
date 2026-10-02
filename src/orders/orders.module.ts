import { Module } from '@nestjs/common';
import { CosmosModule } from '../cosmos/cosmos.module';
import { OrderService } from './order.service';
import { OrdersController } from './orders.controller';
import { OrderReminderService } from './order-reminder.service';
import { CosmosOrderRepository } from './repositories/cosmos-order.repository';
import { ORDER_REPOSITORY } from './repositories/order.repository';

@Module({
  imports: [CosmosModule],
  controllers: [OrdersController],
  providers: [
    OrderService,
    OrderReminderService,
    CosmosOrderRepository,
    {
      provide: ORDER_REPOSITORY,
      useExisting: CosmosOrderRepository,
    },
  ],
  exports: [OrderService],
})
export class OrdersModule {}
