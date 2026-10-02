# Phases 9–35

This file is the operator guide for the phases added after the queue consumer. Code for each phase lives in the paths named below.

## 9. Dead letter

`GET /admin/dead-letter-messages` peeks the `orders-queue` dead-letter sub-queue (`subQueueType: 'deadLetter'`) and returns `messageId`, `correlationId`, `deliveryCount`, and dead-letter reason. It does not replay messages.

Abandon retries the message. After the queue **max delivery count** (set in Azure, recommended `10`), Service Bus dead-letters it. Use abandon for transient failures and dead-letter for invalid contracts. Script note: `infra/azure/create-resources.sh` sets `maxDeliveryCount=10` on the queue.

## 10. Topic fan-out

Set `SERVICE_BUS_ORDERS_TOPIC=orders-topic`. The outbox publisher sends there. Create subscriptions `payment-subscription`, `inventory-subscription`, and `notification-subscription`. Each subscription gets its own copy. `correlationId` is the order id. `OrderCreated.data.items` lists `{ productId, quantity }`.

This repo's fan-out consumer joins `payment-subscription` and `notification-subscription` only. `inventory-subscription` belongs to the sibling Inventory app.

## 11. Independently startable services

```bash
APP_ROLE=order-service npm run start:dev
APP_ROLE=payment-service npm run start:dev
APP_ROLE=notification-service npm run start:dev
APP_ROLE=outbox-publisher npm run start:dev
```

Entry files: `apps/*/src/main.ts`. `apps/inventory-service` still exists and sets `APP_ROLE`, but it does not subscribe. Start the sibling Inventory app for that subscription. Event contracts for `OrderCreated` stay in `src/messaging/events`.

## 12. Payment and inventory

`src/workflow/workflow-decisions.ts` still defines the learning rules and unit tests:

- `userId` ending in `-pay-fail` → payment failed
- product id ending in `-oos` → inventory failed
- otherwise payment completed and inventory reserved
- both success → order status `CONFIRMED`

The payment consumer does not publish `PaymentCompleted` or `PaymentFailed`, and this app does not move the order to `CONFIRMED`.

The Inventory app does publish `InventoryReserved` or `InventoryReservationFailed`. `correlationId` is the order id. `causationId` is the `OrderCreated` event id. A product id ending in `-oos`, or a quantity above available stock, is a failure and does not change stock. Nothing in this repo consumes that result yet, so the order document stays `PENDING` until a status patch.

## 13–15. Transactional batch, outbox, change feed

`POST /orders` writes the order and an `outbox` document in one `items.batch(operations, orderId)` call. If either create fails, Cosmos rolls the batch back. That is **one logical partition**, not a database-wide transaction. The partition key is required because a batch cannot span partitions.

The publisher (`OutboxPublisherService`) uses `getChangeFeedIterator` (pull model). Continuation is stored as document `outbox-publisher-checkpoint`. Send failure increments `attempts` and leaves `status=PENDING`. `publishedAt` is set only after `send()` resolves.

## 16–17. Idempotency and TTL

`claimProcessedEvent` inserts `id = consumer:eventId`, `type=processed-event`, partition `orderId`. A 409 means the duplicate is ignored. `ttl` defaults to `PROCESSED_EVENT_TTL_SECONDS` (604800). Enable TTL on the **container** in Azure or the property is stored but not expired. Order documents do not set `ttl`.

## 18. Sessions

`SERVICE_BUS_SESSIONS_ENABLED=true` sets `sessionId=orderId` on publish. Sessions order events **for one order**. Two orders can run at the same time. Sessions do not order the whole topic.

## 19. Scheduled reminder

`POST /orders/:id/reminder` schedules `OrderReminder` with `ORDER_REMINDER_DELAY_SECONDS` (default 15) via `scheduleMessages`.

## 20. Subscription filters

Reminders set `applicationProperties.notificationType=email`. In Azure, add a SQL filter `notificationType = 'email'` on an email subscription and `notificationType = 'sms'` on an SMS subscription. A message without that property is not delivered to those subscriptions.

## 21. Consistency

This app uses the account default, typically **Session**. Point reads of an order after the same client wrote it are the business-critical reads. Cross-partition status lists can tolerate staleness. Eventual consistency means a subscriber can observe an event before a different client’s read sees the new order document.

## 22–23. RU and hot partitions

Learning routes under `/learning/cosmos/access-patterns` return live `requestChargeRu`. Do not treat those numbers as a benchmark until you run them. `/orderId` spreads orders across partitions. A single popular `orderId` is a hot partition even though the key is valid. The batch still cannot cross partitions.

## 24. Retry vs poison

Transient: Service Bus send failure, abandon. The outbox stays unpublished. Permanent: body is not an event envelope; log and complete (or dead-letter in a later poison policy) so it does not spin. Bounded attempts are `outbox.attempts`.

## 25. Prefetch and concurrency

`SERVICE_BUS_PREFETCH` and `SERVICE_BUS_MAX_CONCURRENT_CALLS` are passed to `subscribe`. Higher concurrency raises throughput until the handler or Cosmos becomes the limit. Prefetch pulls messages before the handler is free; a slow handler can let locks expire. Idempotency is still required because abandon and lock expiry redeliver.

## 26. Failure injection

Disabled unless set, and ignored when `NODE_ENV=production`:

- `SERVICE_BUS_SIMULATE_TRANSIENT_FAILURE=true` abandons queue messages
- a `userId` ending in `-pay-fail` is only the unit-tested payment rule
- a product id ending in `-oos` fails reservation in the Inventory app

## 27. Redis

`REDIS_URL` enables ioredis. `ProductCacheService` caches product names with `PRODUCT_CACHE_TTL_SECONDS`. Invalidate with `invalidate(productId)` when a product changes. Redis is not the source of truth for orders.

## 28. Metrics

`GET /metrics` returns in-process counters (received, completed, abandoned, outbox failures, latency samples).

## 29–32. Docker, Azure, identity, Container Apps

- `docker compose up` starts Redis, `order-service`, `payment-service`, `notification-service`, and `outbox-publisher`. It does not start inventory. Cosmos and Service Bus stay in Azure. No secrets in the compose file.
- `infra/azure/create-resources.sh` creates the resource group, Cosmos database and `orders` container (`/orderId`), Service Bus topic and subscriptions (including `inventory-subscription`), Redis, and a Container Apps environment. The Inventory app creates the `stock` container itself. Fill the variables at the top. Do not commit keys.
- Production should use managed identity: Cosmos Data Contributor and Service Bus Data Sender/Receiver. Local dev can keep a connection string.
- Images: `docker build` using the Dockerfile. Roll back a Container App revision from the Azure portal or `az containerapp revision set-mode` / activate the previous revision.

## 33–35. Load, failure, end-to-end

`load/k6-orders.js` posts orders. Set `BASE_URL`, `VUS`, and `DURATION`. The script does not record results until you run it.

Failure checks are in `docs/failure-testing.md`.

Happy path today: `POST /orders` → batch writes order + outbox → change feed → publisher → topic. Payment and notification log the event. The Inventory app reserves stock or publishes `InventoryReservationFailed`. The order document stays `PENDING` until `PATCH /orders/:id/status`.
