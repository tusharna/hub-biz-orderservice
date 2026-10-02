import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '../../../orders/domain/order-status.enum';

export class SimulateConcurrentWritersDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  etag!: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  firstStatus?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderStatus)
  secondStatus?: OrderStatus;
}
