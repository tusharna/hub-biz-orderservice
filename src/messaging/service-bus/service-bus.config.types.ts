export interface ServiceBusConfiguration {
  /** e.g. my-namespace.servicebus.windows.net */
  namespace: string;
  connectionString: string;
  ordersQueue: string;
  /** When false, the in-process queue consumer does not start (useful for tests). */
  consumerEnabled: boolean;
  simulateTransientFailure: boolean;
  /** Topic name when set; otherwise ordersQueue is the publish target. */
  ordersTopic: string;
  publishEntityName: string;
  outboxPublisherEnabled: boolean;
  sessionsEnabled: boolean;
  prefetchCount: number;
  maxConcurrentCalls: number;
  processedEventTtlSeconds: number;
  appRole: string;
}
