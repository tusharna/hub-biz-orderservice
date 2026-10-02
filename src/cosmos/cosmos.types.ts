import type { CosmosConfiguration } from '../config/configuration';

export interface CosmosItemWithOrderPartitionKey {
  id: string;
  orderId: string;
}

export interface CosmosHealthCheckResult {
  status: 'up' | 'down';
  message?: string;
}

export type CosmosConnectionSettings = CosmosConfiguration;

/** Request units charged for a Cosmos DB operation (from SDK `requestCharge`). */
export interface CosmosRequestMetrics {
  requestChargeRu: number;
}

export interface CosmosReadWithCharge<T> extends CosmosRequestMetrics {
  resource: T | undefined;
  etag?: string;
}

export interface CosmosWriteWithEtag<T> {
  resource: T;
  etag: string;
  requestChargeRu: number;
}

export interface CosmosQueryWithCharge<T> extends CosmosRequestMetrics {
  resources: T[];
}
