# Walkthrough

## What happens after POST /orders

1. The orders page or `OrdersController` validates the body (`userId` and at least one item with `productId`, `quantity`, `price`).
2. `OrderService.createOrder` builds an order id like `order-<uuid>`, status `PENDING`, and a total from the line items.
3. `CosmosOrderRepository.createWithOutbox` writes the order and an outbox document in one Cosmos batch on partition `orderId`. If either write fails, the batch does not commit.
4. `OutboxPublisherService` polls every 5 seconds for `type = 'outbox'` and `status = 'PENDING'`, and also reads the change feed. It sends the message, then marks the outbox published. A send failure leaves the row pending and increments `attempts`. The `OrderCreated` body includes `items` as `{ productId, quantity }`.
5. With a topic configured, each subscription gets its own copy. In this repo, `TopicFanoutConsumer` listens only for `payment-service` (`payment-subscription`) and `notification-service` (`notification-subscription`). It claims `consumer:eventId` in Cosmos. A 409 means that consumer already saw this event, so it completes the message and counts a duplicate. Those two consumers log the event. They do not change the order status.
6. The Inventory app, when it is running, receives the same event on `inventory-subscription`. It reserves stock or publishes `InventoryReservationFailed`. This orders app does not read that result. A status change here is `PATCH /orders/:id/status` with the ETag from `GET /orders/:id`.

`src/workflow/workflow-decisions.ts` still holds the older payment and inventory rules and their unit tests. The payment consumer does not call them. Inventory failure for `-oos` is implemented in the Inventory app.

The queue path (`OrdersQueueConsumer`) logs `OrderCreated` envelopes. Settlement details are in [service-bus-message-settlement.md](service-bus-message-settlement.md).

## HTTP routes

Open `http://localhost:3000/` for the orders page. It calls the routes below.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Orders page |
| `GET` | `/health` | Cosmos up or degraded |
| `POST` | `/orders` | Create an order and its outbox row |
| `GET` | `/orders/:id` | Read the order and its ETag |
| `PATCH` | `/orders/:id/status` | Replace status only if `etag` still matches |
| `POST` | `/orders/:id/reminder` | Schedule an `OrderReminder` message |
| `GET` | `/metrics` | In-process counters (received, completed, abandoned, outbox failures) |
| `GET` | `/admin/dead-letter-messages` | Peek up to 20 dead-lettered queue messages. Does not replay them |
| `GET` | `/learning/cosmos/access-patterns/...` | Compare point read, user query, status query, and partition query, with RU |
| `POST` | `/learning/cosmos/concurrency/simulate-stale-writer` | Show a stale ETag losing a write |

Learning routes are for experiments. They are not a production API.

## Folders

```
src/
  main.ts, bootstrap.ts, app.module.ts   process entry and module list
  config/                                env → typed settings
  cosmos/                                Cosmos client and container access
  orders/                                API, validation, repository, reminder
  messaging/                             event shape, publisher, queue and topic consumers
  outbox/                                transactional outbox + change feed publisher
  idempotency/                           claim a processed event once per consumer
  workflow/                              payment and inventory rules covered by unit tests
  admin/                                 dead-letter peek
  observability/                         counters behind GET /metrics
  cache/                                 product name cache (Redis or memory)
  health/
  learning/                              Cosmos access-pattern and ETag demos
public/                                  orders page (index.html, styles.css, app.js)
apps/                                    one main.ts per role (sets APP_ROLE)
infra/azure/create-resources.sh          Azure CLI setup
load/k6-orders.js                        simple order load script
docs/                                    these notes
```

The Inventory app is the sibling folder `Inventory`, not `apps/inventory-service`.

`dist/` is build output. `node_modules/` is dependencies. Both can be ignored while reading.

## Document types in the orders container

Everything shares partition key `orderId`.

| `type` | Role |
| --- | --- |
| `order` | The order the API returns |
| `outbox` | Event waiting to be sent, then marked published |
| `processed-event` | Idempotency claim, id `consumer:eventId` |
| checkpoint id `outbox-publisher-checkpoint` | Change feed continuation |

Orders do not set a TTL. Processed events use `PROCESSED_EVENT_TTL_SECONDS` (default 7 days). The container itself must have TTL enabled in Azure or that property is stored and never expires.

Stock and reservation documents are not in this container. They live in the Inventory app's `stock` container, partitioned by `/productId`.
