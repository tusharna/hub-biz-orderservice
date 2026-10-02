import { Module } from '@nestjs/common';
import { DeadLetterController } from './dead-letter.controller';

@Module({
  controllers: [DeadLetterController],
})
export class AdminModule {}
