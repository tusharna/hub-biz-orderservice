import { Global, Module } from '@nestjs/common';
import { AzureServiceBusMessageProducer } from './azure-service-bus-message-producer';
import { OrderEventPublisher } from '../orders/order-event.publisher';
import { MESSAGE_PRODUCER } from '../producer/message-producer.interface';
import { OrdersQueueConsumer } from './orders-queue.consumer';
import { TopicFanoutConsumer } from './topic-fanout.consumer';
import { ServiceBusConnectionService } from './service-bus-connection.service';

@Global()
@Module({
  providers: [
    ServiceBusConnectionService,
    AzureServiceBusMessageProducer,
    {
      provide: MESSAGE_PRODUCER,
      useExisting: AzureServiceBusMessageProducer,
    },
    OrderEventPublisher,
    OrdersQueueConsumer,
    TopicFanoutConsumer,
  ],
  exports: [MESSAGE_PRODUCER, OrderEventPublisher, ServiceBusConnectionService],
})
export class ServiceBusModule {}
