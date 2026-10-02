# Overview

This is a NestJS learning app for orders on Azure. Orders live in Cosmos DB. Events go out through Azure Service Bus. Redis only caches product names.

Stock is a separate NestJS app in the sibling `Inventory` folder. It owns the Cosmos `stock` container and `inventory-subscription`. This repo must not listen on that subscription. `APP_ROLE=inventory-service` logs that fact and returns.

The rest of this codebase can run as one process or as separate roles. Each role sets `APP_ROLE` and starts from `apps/*/src/main.ts`. They all boot the same `AppModule` in `src/app.module.ts`.

## Roles in this repo

| Role | What it does |
| --- | --- |
| `order-service` | HTTP API on port 3000, including the orders page. Creates orders and writes the outbox document. Does not publish events itself. |
| `outbox-publisher` | Reads pending outbox rows and the Cosmos change feed, then sends Service Bus messages. |
| `payment-service` | Listens on `payment-subscription`. Logs the event, claims it once, and completes the message. |
| `notification-service` | Listens on `notification-subscription`. Logs the event after an idempotency claim. |
| `inventory-service` | Kept so old commands still start, but it does not receive `inventory-subscription`. |

`APP_ROLE=all` (the default in `.env.example`) turns the outbox publisher on in the same process as the API. Queue consuming is on unless `SERVICE_BUS_CONSUMER_ENABLED=false`.

## Outside systems

- **Cosmos DB** database `ecommerce`, container `orders`, partition key `/orderId`. One container holds orders, outbox documents, processed-event claims, and the publisher checkpoint. The Inventory app uses a different container, `stock`, partitioned by `/productId`.
- **Service Bus** queue `orders-queue` and topic `orders-topic`. The publisher sends to the topic when `SERVICE_BUS_ORDERS_TOPIC` is set, otherwise to the queue name. `OrderCreated` includes `items` (`productId` and `quantity`) plus `itemCount`.
- **Redis** is optional. Without `REDIS_URL`, product names stay in process memory.

Payment and notification do not call the orders API. The Inventory app does not call it either. It publishes `InventoryReserved` or `InventoryReservationFailed` onto `orders-topic`. This orders app does not consume those result events, so order status stays `PENDING` until `PATCH /orders/:id/status`.

## Status rules

New orders are stored as `PENDING`. Later status changes go through `PATCH /orders/:id/status` with the current ETag.

`src/workflow/workflow-decisions.ts` holds payment and inventory outcome rules used by unit tests. The payment and notification consumers do not call those functions. The live inventory rule is in the Inventory app: a product id ending in `-oos`, or a quantity above `available`, fails the reservation.

- `userId` ending in `-pay-fail` is the payment-failure rule in `workflow-decisions.ts`. The payment consumer does not apply it yet.
- A product id ending in `-oos` fails reservation in the Inventory app and does not change stock.
- The enum also includes `PAID`, `INVENTORY_RESERVED`, `CONFIRMED`, `FAILED`, `PROCESSING`, `PAYMENT_PENDING`, and `CANCELLED` for manual or learning updates.
