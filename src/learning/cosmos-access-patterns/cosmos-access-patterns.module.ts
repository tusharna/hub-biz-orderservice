import { Module } from '@nestjs/common';
import { CosmosModule } from '../../cosmos/cosmos.module';
import { CosmosAccessPatternsController } from './cosmos-access-patterns.controller';
import { CosmosAccessPatternsService } from './cosmos-access-patterns.service';

@Module({
  imports: [CosmosModule],
  controllers: [CosmosAccessPatternsController],
  providers: [CosmosAccessPatternsService],
})
export class CosmosAccessPatternsModule {}
