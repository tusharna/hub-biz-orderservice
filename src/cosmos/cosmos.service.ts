import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CosmosClient,
  type Container,
  type Database,
  type JSONObject,
  type OperationInput,
  type SqlQuerySpec,
} from '@azure/cosmos';
import type { AppConfiguration } from '../config/configuration';
import { ORDERS_PARTITION_KEY_PROPERTY } from './cosmos.constants';
import type {
  CosmosHealthCheckResult,
  CosmosItemWithOrderPartitionKey,
  CosmosQueryWithCharge,
  CosmosReadWithCharge,
  CosmosWriteWithEtag,
} from './cosmos.types';

@Injectable()
export class CosmosService implements OnModuleDestroy {
  private readonly logger = new Logger(CosmosService.name);
  private client: CosmosClient | undefined;

  constructor(
    private readonly configService: ConfigService<AppConfiguration, true>,
  ) {}

  onModuleDestroy(): void {
    this.client = undefined;
  }

  /** Returns the shared SDK client (lazy-initialized). */
  getClient(): CosmosClient {
    if (!this.client) {
      const cosmos = this.configService.get('cosmos', { infer: true });
      this.client = new CosmosClient({
        endpoint: cosmos.endpoint,
        key: cosmos.key,
      });
    }
    return this.client;
  }

  getDatabase(): Database {
    const cosmos = this.configService.get('cosmos', { infer: true });
    return this.getClient().database(cosmos.database);
  }

  /** Orders container (partition key path `/orderId`). */
  getOrdersContainer(): Container {
    const cosmos = this.configService.get('cosmos', { infer: true });
    return this.getDatabase().container(cosmos.ordersContainer);
  }

  /**
   * Creates an item in the orders container.
   * The document must include `orderId` (partition key value).
   */
  async createItem<T extends CosmosItemWithOrderPartitionKey>(
    item: T,
  ): Promise<T> {
    this.assertOrderPartitionKey(item);
    const { resource } = await this.getOrdersContainer().items.create(item);
    if (!resource) {
      throw new ServiceUnavailableException(
        'Cosmos DB did not return the created item.',
      );
    }
    return resource;
  }

  /** Replaces an existing item (same `id` and partition key `orderId`). */
  async replaceItem<T extends CosmosItemWithOrderPartitionKey>(
    item: T,
  ): Promise<T> {
    this.assertOrderPartitionKey(item);
    const { resource } = await this.getOrdersContainer()
      .item(item.id, item.orderId)
      .replace(item);
    if (!resource) {
      throw new ServiceUnavailableException(
        'Cosmos DB did not return the replaced item.',
      );
    }
    return resource;
  }

  /** Point read by document id and partition key value (`orderId`). */
  async readItemById<T extends JSONObject>(
    id: string,
    orderId: string,
  ): Promise<T | undefined> {
    const result = await this.readItemByIdWithCharge<T>(id, orderId);
    return result.resource;
  }

  /** Point read including RU charge from the SDK response. */
  async readItemByIdWithCharge<T extends JSONObject>(
    id: string,
    orderId: string,
  ): Promise<CosmosReadWithCharge<T>> {
    try {
      const response = await this.getOrdersContainer()
        .item(id, orderId)
        .read<T>();
      return {
        resource: response.resource,
        requestChargeRu: response.requestCharge ?? 0,
        etag: response.etag,
      };
    } catch (error: unknown) {
      if (this.isNotFoundError(error)) {
        return { resource: undefined, requestChargeRu: 0 };
      }
      throw error;
    }
  }

  /**
   * Replaces an item only if the stored etag matches (If-Match).
   * @throws Cosmos 412 Precondition Failed when etag is stale
   */
  async replaceItemIfMatch<T extends CosmosItemWithOrderPartitionKey>(
    item: T,
    etag: string,
  ): Promise<CosmosWriteWithEtag<T>> {
    this.assertOrderPartitionKey(item);
    if (!etag.trim()) {
      throw new Error('etag must not be empty for conditional replace.');
    }

    const response = await this.getOrdersContainer()
      .item(item.id, item.orderId)
      .replace(item, {
        accessCondition: { type: 'IfMatch', condition: etag },
      });
    if (!response.resource) {
      throw new ServiceUnavailableException(
        'Cosmos DB did not return the replaced item.',
      );
    }
    return {
      resource: response.resource,
      etag: response.etag,
      requestChargeRu: response.requestCharge ?? 0,
    };
  }

  /**
   * Runs a SQL query against the orders container.
   * Optionally scopes the query to a single logical partition (`orderId`).
   */
  async queryItems<T extends JSONObject>(
    querySpec: SqlQuerySpec,
    partitionKeyOrderId?: string,
  ): Promise<T[]> {
    const result = await this.queryItemsWithCharge<T>(
      querySpec,
      partitionKeyOrderId,
    );
    return result.resources;
  }

  /** SQL query including RU charge reported by `fetchAll()`. */
  async queryItemsWithCharge<T extends JSONObject>(
    querySpec: SqlQuerySpec,
    partitionKeyOrderId?: string,
  ): Promise<CosmosQueryWithCharge<T>> {
    const options =
      partitionKeyOrderId !== undefined
        ? { partitionKey: partitionKeyOrderId }
        : undefined;
    const response = await this.getOrdersContainer()
      .items.query<T>(querySpec, options)
      .fetchAll();
    return {
      resources: response.resources,
      requestChargeRu: response.requestCharge ?? 0,
    };
  }

  /**
   * Transactional batch scoped to one logical partition (`orderId`).
   * Cosmos rolls back the whole batch if any operation fails. This is not a database-wide transaction.
   */
  async executePartitionBatch(
    orderId: string,
    operations: OperationInput[],
  ): Promise<void> {
    if (!orderId.trim()) {
      throw new Error(
        'Partition key orderId is required for a transactional batch.',
      );
    }
    const response = await this.getOrdersContainer().items.batch(
      operations,
      orderId,
    );
    const failed = (response.result ?? []).find(
      (entry) => entry.statusCode >= 400,
    );
    if (failed) {
      throw new Error(
        `Cosmos transactional batch failed with status ${failed.statusCode}.`,
      );
    }
  }
  async checkHealth(): Promise<CosmosHealthCheckResult> {
    try {
      await this.getOrdersContainer().read();
      return { status: 'up' };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown Cosmos DB error';
      this.logger.warn(`Cosmos DB health check failed: ${message}`);
      return { status: 'down', message };
    }
  }

  private assertOrderPartitionKey(item: CosmosItemWithOrderPartitionKey): void {
    if (!item.id?.trim()) {
      throw new Error('Cosmos item must include a non-empty id.');
    }
    if (!item[ORDERS_PARTITION_KEY_PROPERTY]?.trim()) {
      throw new Error(
        `Cosmos item must include a non-empty ${ORDERS_PARTITION_KEY_PROPERTY} (partition key value).`,
      );
    }
    if (item.id !== item.orderId) {
      this.logger.debug(
        `Item id "${item.id}" differs from orderId "${item.orderId}"; partition key value is orderId.`,
      );
    }
  }

  private isNotFoundError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    return (error as { code?: number }).code === 404;
  }
}
