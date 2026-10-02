import { Module } from '@nestjs/common';
import { CosmosModule } from '../cosmos/cosmos.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [CosmosModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
