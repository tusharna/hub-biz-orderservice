import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/**
 * Product name cache. Redis is used when REDIS_URL is set.
 * Orders and payments stay in Cosmos DB.
 */
@Injectable()
export class ProductCacheService {
  private readonly logger = new Logger(ProductCacheService.name);
  private readonly memory = new Map<string, CacheEntry>();
  private client: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
    del(key: string): Promise<unknown>;
  } | null = null;

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log('REDIS_URL is unset; product cache uses process memory.');
      return;
    }
    this.client = new Redis(url);
  }

  async getProductName(productId: string): Promise<string | undefined> {
    const key = `product:${productId}`;
    if (this.client) {
      const cached = await this.client.get(key);
      if (cached) {
        this.logger.log(JSON.stringify({ cache: 'hit', productId }));
        return cached;
      }
      this.logger.log(JSON.stringify({ cache: 'miss', productId }));
      return undefined;
    }
    const entry = this.memory.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      this.logger.log(JSON.stringify({ cache: 'miss', productId }));
      return undefined;
    }
    this.logger.log(JSON.stringify({ cache: 'hit', productId }));
    return entry.value;
  }

  async setProductName(
    productId: string,
    name: string,
    ttlSeconds = Number(process.env.PRODUCT_CACHE_TTL_SECONDS ?? '60'),
  ): Promise<void> {
    const key = `product:${productId}`;
    if (this.client) {
      await this.client.set(key, name, 'EX', ttlSeconds);
      return;
    }
    this.memory.set(key, {
      value: name,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async invalidate(productId: string): Promise<void> {
    const key = `product:${productId}`;
    if (this.client) {
      await this.client.del(key);
    }
    this.memory.delete(key);
  }
}
