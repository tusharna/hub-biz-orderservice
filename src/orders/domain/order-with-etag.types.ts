import type { Order } from './order.types';

/** Order document plus Cosmos concurrency token from the last read. */
export interface OrderWithEtag {
  order: Order;
  etag: string;
}

/** API shape: order fields plus `etag` for conditional updates. */
export type OrderWithEtagResponse = Order & { etag: string };
