import { Controller, Get, Param } from '@nestjs/common';
import { CosmosAccessPatternsService } from './cosmos-access-patterns.service';

/**
 * Learning routes — compare Cosmos access patterns and RU cost.
 * Not intended as production API surface area.
 */
@Controller('learning/cosmos/access-patterns')
export class CosmosAccessPatternsController {
  constructor(
    private readonly accessPatternsService: CosmosAccessPatternsService,
  ) {}

  @Get('point-read/:orderId')
  demonstratePointRead(@Param('orderId') orderId: string) {
    return this.accessPatternsService.demonstratePointRead(orderId);
  }

  @Get('by-user/:userId')
  demonstrateQueryByUserId(@Param('userId') userId: string) {
    return this.accessPatternsService.demonstrateQueryByUserId(userId);
  }

  @Get('by-status/:status')
  demonstrateQueryByStatus(@Param('status') status: string) {
    return this.accessPatternsService.demonstrateQueryByStatus(status);
  }

  @Get('partition-query/:orderId')
  demonstratePartitionScopedQuery(@Param('orderId') orderId: string) {
    return this.accessPatternsService.demonstratePartitionScopedQuery(orderId);
  }
}
