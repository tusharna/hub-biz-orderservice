import { Body, Controller, Post } from '@nestjs/common';
import { OrderStatus } from '../../orders/domain/order-status.enum';
import { OrderService } from '../../orders/order.service';
import { SimulateConcurrentWritersDto } from './dto/simulate-concurrent-writers.dto';

/** Demos Cosmos ETag / If-Match behavior for learning (not production API). */
@Controller('learning/cosmos/concurrency')
export class CosmosConcurrencyLearningController {
  constructor(private readonly orderService: OrderService) {}

  @Post('simulate-stale-writer')
  simulateStaleWriter(@Body() dto: SimulateConcurrentWritersDto) {
    return this.orderService.simulateConcurrentStatusUpdates(
      dto.orderId,
      dto.etag,
      dto.firstStatus ?? OrderStatus.PROCESSING,
      dto.secondStatus ?? OrderStatus.PAID,
    );
  }
}
