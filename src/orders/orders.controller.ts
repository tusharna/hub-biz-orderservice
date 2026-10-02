import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { OrderWithEtagResponse } from './domain/order-with-etag.types';
import type { Order } from './domain/order.types';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderReminderService } from './order-reminder.service';
import { OrderService } from './order.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderReminderService: OrderReminderService,
  ) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.createOrder(dto);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string): Promise<OrderWithEtagResponse> {
    const withEtag = await this.orderService.getOrderWithEtag(id);
    return this.orderService.toOrderResponse(withEtag);
  }

  @Post(':id/reminder')
  scheduleReminder(@Param('id') id: string) {
    return this.orderReminderService.scheduleReminder(id);
  }

  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<OrderWithEtagResponse> {
    const updated = await this.orderService.updateOrderStatusIfMatch(
      id,
      dto.status,
      dto.etag,
    );
    return this.orderService.toOrderResponse(updated);
  }
}
