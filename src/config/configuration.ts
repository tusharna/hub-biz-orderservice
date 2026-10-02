import type { ServiceBusConfiguration } from '../messaging/service-bus/service-bus.config.types';
import { isTransientFailureSimulationEnabled } from '../messaging/service-bus/message-settlement';

export interface CosmosConfiguration {
  endpoint: string;
  key: string;
  database: string;
  ordersContainer: string;
}

export interface AppConfiguration {
  nodeEnv: string;
  port: number;
  cosmos: CosmosConfiguration;
  serviceBus: ServiceBusConfiguration;
}

function parseBooleanEnv(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return defaultValue;
}

/** Maps environment variables to typed application settings. */
export default (): AppConfiguration => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  cosmos: {
    endpoint: process.env.COSMOS_ENDPOINT ?? '',
    key: process.env.COSMOS_KEY ?? '',
    database: process.env.COSMOS_DATABASE ?? '',
    ordersContainer: process.env.COSMOS_ORDERS_CONTAINER ?? '',
  },
  serviceBus: {
    namespace: process.env.SERVICE_BUS_NAMESPACE ?? '',
    connectionString: process.env.SERVICE_BUS_CONNECTION_STRING ?? '',
    ordersQueue: process.env.SERVICE_BUS_ORDERS_QUEUE ?? '',
    consumerEnabled: parseBooleanEnv(
      process.env.SERVICE_BUS_CONSUMER_ENABLED,
      true,
    ),
    simulateTransientFailure: isTransientFailureSimulationEnabled({
      nodeEnv: process.env.NODE_ENV ?? 'development',
      simulateFlag: parseBooleanEnv(
        process.env.SERVICE_BUS_SIMULATE_TRANSIENT_FAILURE,
        false,
      ),
    }),
    ordersTopic: process.env.SERVICE_BUS_ORDERS_TOPIC ?? '',
    publishEntityName:
      process.env.SERVICE_BUS_ORDERS_TOPIC?.trim() ||
      process.env.SERVICE_BUS_ORDERS_QUEUE ||
      'orders-queue',
    outboxPublisherEnabled: parseBooleanEnv(
      process.env.OUTBOX_PUBLISHER_ENABLED,
      (process.env.APP_ROLE ?? 'all') === 'all' ||
        process.env.APP_ROLE === 'outbox-publisher',
    ),
    sessionsEnabled: parseBooleanEnv(
      process.env.SERVICE_BUS_SESSIONS_ENABLED,
      false,
    ),
    prefetchCount: parseInt(process.env.SERVICE_BUS_PREFETCH ?? '0', 10) || 0,
    maxConcurrentCalls:
      parseInt(process.env.SERVICE_BUS_MAX_CONCURRENT_CALLS ?? '1', 10) || 1,
    processedEventTtlSeconds:
      parseInt(process.env.PROCESSED_EVENT_TTL_SECONDS ?? '604800', 10) ||
      604800,
    appRole: process.env.APP_ROLE ?? 'all',
  },
});
