# Azure Service Bus + Cosmos DB — Cursor Execution Plan

This file is the original build plan. It is not the operator guide.

Current behavior is in `docs/`. Two points in this plan are no longer how the code runs:

- Inventory is a separate NestJS app in the sibling `Inventory` folder. It listens on `inventory-subscription`, reserves stock, and publishes `InventoryReserved` or `InventoryReservationFailed`. `apps/inventory-service` in this repo does not join that subscription.
- Payment still only logs `OrderCreated`. The order status does not move to `CONFIRMED` on its own.

## Project

Build an Azure-native, event-driven e-commerce backend using:

- Node.js
- TypeScript
- NestJS
- Azure Cosmos DB for NoSQL
- Azure Service Bus
- Redis
- Docker
- Azure Container Apps
- Jest
- `@azure/cosmos`
- `@azure/service-bus`
- `@azure/identity`

This version intentionally replaces **PostgreSQL + Prisma** with **Azure Cosmos DB for NoSQL**. For Node.js, use the official Cosmos SDK rather than Prisma.

The project is designed to teach both Cosmos DB and Service Bus through one realistic system.

---

# 1. Final Architecture

```text
                         Client
                           |
                           v
                    +---------------+
                    |   Order API   |
                    |    NestJS     |
                    +-------+-------+
                            |
                            v
                   +-------------------+
                   | Azure Cosmos DB    |
                   |     for NoSQL      |
                   |                   |
                   | orders container  |
                   +---------+---------+
                             |
                       Change Feed
                             |
                             v
                   +-------------------+
                   | Outbox Publisher  |
                   |     NestJS        |
                   +---------+---------+
                             |
                             v
                   +-------------------+
                   | Azure Service Bus |
                   |   Orders Topic    |
                   +---+-------+-------+
                       |       |
              +--------+       +---------+
              v                          v
       Payment Subscription      Inventory Subscription
              |                          |
              v                          v
       Payment Service          Inventory Service
              \                          /
               \                        /
                +---------+------------+
                          |
                          v
                  Notification Service

                       Redis
                         |
                         +-- cache
                         +-- short-lived state
```

The intended final flow is:

```text
POST /orders
    |
    v
Cosmos Transactional Batch
    |
    +--> Order document
    +--> Outbox event
             |
             v
       Cosmos Change Feed
             |
             v
       Outbox Publisher
             |
             v
      Service Bus Topic
       /      |       \
      v       v        v
  Payment  Inventory Notification
```

---

# 2. Important Design Decisions

## Cosmos DB instead of PostgreSQL + Prisma

Use:

```text
@azure/cosmos
```

for application data access.

Do not add Prisma or PostgreSQL to this project.

## Initial partition key

Use:

```text
/orderId
```

for the learning project.

This makes a single order the initial transaction boundary:

```text
order-1001
  |
  +-- Order document
  +-- Outbox document
  +-- Processed-event documents
```

Cosmos DB transactional batches are scoped to a single logical partition, so partition-key design is a central part of this project.

## Service Bus event ordering

Use:

```text
sessionId = orderId
```

for workflows that need per-order ordering.

## Outbox

Use Cosmos DB Transactional Batch to create the order and its outbox event atomically, then use Cosmos Change Feed to publish the event asynchronously to Service Bus.

For Node.js, use a supported Change Feed approach (pull model or Azure Functions); do not assume the .NET/Java Change Feed Processor library is available for Node.js.

---

# 3. Cursor Rules

Paste this at the beginning of the Cursor project.

```text
You are helping me build a production-style Azure-native event-driven e-commerce system.

Tech stack:
- Node.js
- TypeScript
- NestJS
- Azure Cosmos DB for NoSQL
- Azure Service Bus
- Redis
- Docker
- Azure Container Apps
- Jest
- @azure/cosmos
- @azure/service-bus
- @azure/identity

This is also a learning project.

IMPORTANT RULES:
1. Implement only the phase I explicitly request.
2. Inspect the repository before changing files.
3. Make the smallest production-quality change needed for the current phase.
4. Do not silently change architecture.
5. Use strict TypeScript.
6. Avoid `any` unless unavoidable.
7. Never hard-code secrets.
8. Use environment variables for local configuration.
9. Prefer Azure passwordless authentication for production.
10. Use official Azure SDKs.
11. If an SDK API is uncertain, inspect installed types/current official documentation instead of guessing.
12. Keep Azure SDK plumbing behind reusable NestJS providers/services.
13. Keep business logic separate from cloud SDK code.
14. Add tests for important business behavior.
15. Do not add PostgreSQL or Prisma.
16. Treat Cosmos partition-key design as an explicit architectural decision.
17. Use Cosmos Transactional Batch only where operations share a logical partition.
18. For Change Feed, use a Node.js-supported approach.
19. Preserve working behavior from earlier phases.
20. After implementation, return:
   - files changed
   - commands to run
   - tests run
   - expected result
   - known limitations
   - concepts I should understand before the next phase

Do not generate the whole project in one response.
```

---

# 4. Phase 1 — Bootstrap NestJS

## Goal

Create the base NestJS application only.

## Cursor Prompt

```text
Implement Phase 1 only.

Create a clean NestJS TypeScript application.

Requirements:
- strict TypeScript
- ESLint
- Prettier
- Jest
- environment configuration
- GET /health returning { "status": "ok" }
- .env.example
- scripts for dev/build/test/lint

Do NOT add:
- Cosmos DB
- Service Bus
- Redis
- Docker
- microservices

Inspect the repository first.

After implementation:
1. show changed files
2. show commands
3. show expected output
4. run build/tests if available
5. list manual verification steps
```

Verify:

```bash
npm run build
npm test
npm run lint
npm run start:dev
```

Commit:

```bash
git add .
git commit -m "chore: bootstrap nestjs project"
```

---

# 5. Phase 2 — Cosmos DB Connection

## Goal

Introduce Azure Cosmos DB before messaging.

Resources:

```text
Cosmos Account
   |
   v
Database: ecommerce
   |
   v
Container: orders
Partition key: /orderId
```

## Cursor Prompt

```text
Implement Phase 2 only.

Add Azure Cosmos DB for NoSQL using @azure/cosmos.

Requirements:
1. Add @azure/cosmos.
2. Create a reusable CosmosModule/CosmosService.
3. Configuration:
   COSMOS_ENDPOINT
   COSMOS_KEY
   COSMOS_DATABASE
   COSMOS_ORDERS_CONTAINER
4. Add .env.example values.
5. Support:
   - database access
   - container access
   - item create
   - item read by id + partition key
   - basic query
6. Use partition key /orderId.
7. Add a Cosmos health check.
8. Do not add Service Bus yet.
9. Do not add Redis yet.
10. Do not add Prisma/PostgreSQL.

Also document:
- logical partition
- partition key
- point read
- query
- why /orderId is being used for this learning project
```

Verify the application can connect and perform a point read/write.

---

# 6. Phase 3 — Cosmos Order Document

## Goal

Learn document modeling.

Order example:

```json
{
  "id": "order-1001",
  "type": "order",
  "orderId": "order-1001",
  "userId": "user-100",
  "status": "PENDING",
  "items": [
    {
      "productId": "product-100",
      "quantity": 2,
      "price": 500
    }
  ],
  "totalAmount": 1000,
  "createdAt": "2026-09-20T10:00:00Z",
  "updatedAt": "2026-09-20T10:00:00Z"
}
```

## Cursor Prompt

```text
Implement Phase 3 only.

Create the Order domain using Cosmos DB documents.

Requirements:
1. Define TypeScript Order and OrderItem types.
2. Create OrderRepository abstraction.
3. Implement it with @azure/cosmos.
4. Use partition key = orderId.
5. Support:
   - createOrder
   - getOrder
   - updateOrderStatus
6. Calculate totalAmount in business logic.
7. Add validation.
8. Add unit/repository tests with mocked Cosmos calls where practical.
9. Do not add Service Bus.

Explain how the document model differs from a relational schema.
```

---

# 7. Phase 4 — Order API

## Goal

Build:

```http
POST /orders
GET /orders/:id
```

## Cursor Prompt

```text
Implement Phase 4 only.

Build the Order API on top of the Cosmos OrderRepository.

POST /orders request:
{
  "userId": "user-100",
  "items": [
    {
      "productId": "product-100",
      "quantity": 2,
      "price": 500
    }
  ]
}

Requirements:
- DTO validation
- server-side total calculation
- Cosmos persistence
- correct HTTP status codes
- thin controller
- service owns business logic
- tests
- do not add Service Bus yet
```

Verify:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-100","items":[{"productId":"product-100","quantity":2,"price":500}]}'
```

---

# 8. Phase 5 — Point Reads, Queries and RU Awareness

## Goal

Learn how Cosmos access patterns differ from relational databases.

## Cursor Prompt

```text
Implement Phase 5 only.

Create a small learning/demo module for Cosmos access patterns.

Demonstrate:
1. Point read by id + partition key.
2. Query by userId.
3. Query by status.
4. Capture request charge/RU information where available.
5. Explain partition-local vs cross-partition access.

Do not redesign the project.

Add documentation explaining:
- RU consumption
- point reads
- queries
- cross-partition queries
- why partition-aware access matters
```

---

# 9. Phase 6 — ETag / Optimistic Concurrency

## Goal

Understand concurrent writes.

## Cursor Prompt

```text
Implement Phase 6 only.

Add optimistic concurrency using Cosmos ETags.

Requirements:
1. Read an order with its ETag.
2. Update conditionally using the ETag/If-Match mechanism.
3. Simulate two writers using the same original ETag.
4. Ensure the stale writer fails cleanly.
5. Translate Cosmos concurrency errors into an application-level conflict.
6. Add tests.
7. Explain why this is useful for order state transitions.
```

---

# 10. Phase 7 — Azure Service Bus Queue

## Goal

Start Service Bus with the simplest possible flow.

```text
Order API
   |
   v
orders-queue
   |
   v
Order Worker
```

## Cursor Prompt

```text
Implement Phase 7 only.

Add Azure Service Bus using @azure/service-bus.

Requirements:
1. Create a reusable ServiceBusModule/provider.
2. Add configuration for namespace and queue.
3. Create a producer abstraction.
4. Define:

EventEnvelope<T> {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  data: T;
}

5. Create OrderCreated.
6. Send OrderCreated to orders-queue.
7. Create a basic consumer that logs the event.
8. Do not implement Outbox yet.
9. Do not add topics/sessions/retry/DLQ yet.
10. Keep Service Bus SDK details behind the messaging abstraction.

Inspect installed SDK types/current official docs rather than guessing method names.
```

---

# 11. Phase 8 — Message Settlement

## Goal

Learn:

```text
Peek-Lock
Complete
Abandon
```

## Cursor Prompt

```text
Implement Phase 8 only.

Enhance the Service Bus consumer.

Requirements:
1. Use peek-lock.
2. Complete after successful processing.
3. Abandon on controlled transient failure.
4. Log messageId, deliveryCount, correlationId and eventType.
5. Add a development-only failure switch.
6. Add tests for success/failure behavior.
7. Document:
   receive -> process -> complete
   receive -> fail -> abandon -> redelivery
```

---

# 12. Phase 9 — Dead Letter Queue

## Goal

Learn poison message handling.

## Cursor Prompt

```text
Implement Phase 9 only.

Add dead-letter handling.

Requirements:
1. Configure max delivery count on the Service Bus entity.
2. Add a DLQ receiver.
3. Add:
   GET /admin/dead-letter-messages
4. Return useful message metadata.
5. Do not add DLQ reprocessing yet.
6. Add tests.
7. Document retry vs dead-letter decisions.
```

Verify:

```text
failure
  -> retry
  -> retry
  -> retry
  -> DLQ
```

---

# 13. Phase 10 — Orders Topic and Subscriptions

Create:

```text
orders-topic
  |
  +-- payment-subscription
  +-- inventory-subscription
  +-- notification-subscription
```

## Cursor Prompt

```text
Implement Phase 10 only.

Move OrderCreated from the simple queue to an Azure Service Bus topic.

Create subscriptions:
- payment-subscription
- inventory-subscription
- notification-subscription

Requirements:
1. Publish OrderCreated to the topic.
2. Each subscription independently receives the event.
3. Demonstrate fan-out.
4. Preserve correlationId.
5. Add routing tests.
6. Do not add business logic yet.
```

---

# 14. Phase 11 — Split NestJS Services

Create:

```text
apps/
  order-service/
  payment-service/
  inventory-service/
  notification-service/
```

## Cursor Prompt

```text
Implement Phase 11 only.

Refactor into independently startable NestJS services:
- order-service
- payment-service
- inventory-service
- notification-service

Requirements:
- preserve current behavior
- shared event contracts
- shared messaging abstractions
- no duplicated event schemas
- service-specific configuration
- each service startable independently
- do not add advanced workflow yet
```

---

# 15. Phase 12 — Payment and Inventory Events

## Cursor Prompt

```text
Implement Phase 12 only.

Payment Service:
- consume OrderCreated
- simulate payment
- publish PaymentCompleted or PaymentFailed

Inventory Service:
- consume OrderCreated
- simulate stock reservation
- publish InventoryReserved or InventoryReservationFailed

Requirements:
1. Use the event envelope.
2. Preserve correlationId.
3. Add causationId.
4. Services communicate through Service Bus events, not direct HTTP calls.
5. Add unit tests.
6. Make simulated outcomes deterministic in tests.
```

---

# 16. Phase 13 — Cosmos Transactional Batch

## Goal

Learn atomic writes within one logical partition.

Target:

```text
partition = order-1001

Transactional Batch
   |
   +--> Order document
   +--> Outbox document
```

## Cursor Prompt

```text
Implement Phase 13 only.

Introduce Cosmos DB TransactionalBatch.

Requirements:
1. Order and Outbox documents use the same partition key: orderId.
2. Create both in one transactional batch.
3. Both operations succeed or fail together.
4. Add a helper abstraction so business code does not depend directly on low-level SDK details.
5. Add tests for success and intentional failure.
6. Do not publish to Service Bus inside the batch.
7. Explain why this is NOT a database-wide transaction.
8. Explain why the partition key is critical.
```

---

# 17. Phase 14 — Cosmos Outbox

## Goal

Persist the event intent atomically with the order.

Example:

```json
{
  "id": "evt-1001",
  "type": "outbox",
  "orderId": "order-1001",
  "eventId": "evt-1001",
  "eventType": "OrderCreated",
  "status": "PENDING",
  "payload": {},
  "createdAt": "2026-09-20T10:00:00Z",
  "publishedAt": null,
  "attempts": 0,
  "lastError": null
}
```

## Cursor Prompt

```text
Implement Phase 14 only.

Create the Cosmos OutboxEvent model.

Requirements:
- same orders container initially
- partition key = orderId
- type = outbox
- eventId
- eventType
- orderId
- status
- payload
- createdAt
- publishedAt
- attempts
- lastError

Create Order + OutboxEvent in a single Cosmos TransactionalBatch.

Do not publish directly to Service Bus from POST /orders.
```

---

# 18. Phase 15 — Cosmos Change Feed Outbox Publisher

## Goal

Connect Cosmos DB to Service Bus asynchronously.

```text
Cosmos
  |
  v
Change Feed
  |
  v
Outbox Publisher
  |
  v
Service Bus
```

## Cursor Prompt

```text
Implement Phase 15 only.

Build an Outbox Publisher using a Node.js-supported Cosmos DB Change Feed approach.

Requirements:
1. Read changes from the orders container.
2. Identify type=outbox documents.
3. Publish pending outbox events to Azure Service Bus.
4. Preserve eventId as the Service Bus messageId where appropriate.
5. On successful publish, mark the outbox as published.
6. On failure, increment attempts and save lastError.
7. Never mark published before a successful send.
8. Add retry behavior.
9. Make the publisher restart-safe.
10. Log eventId, orderId and correlationId.
11. Add tests for Service Bus unavailable -> retry later.
12. Do not assume the .NET/Java Change Feed Processor library exists for Node.js; use a Node.js-supported Change Feed approach.
```

Important flow:

```text
Cosmos transaction succeeds
        |
        v
Change Feed
        |
Service Bus unavailable
        |
        v
outbox remains unpublished
        |
        v
retry
```

---

# 19. Phase 16 — Idempotent Consumers

## Goal

Make duplicate delivery safe.

## Cursor Prompt

```text
Implement Phase 16 only.

Add persistent consumer idempotency using Cosmos DB.

Create processed-event documents with a deterministic id such as:
consumer:eventId

Requirements:
- eventId
- consumer
- processedAt
- orderId
- type=processed-event

Before business processing, determine whether the event has already been processed.

Requirements:
1. First delivery performs one business operation.
2. Duplicate delivery creates no second business effect.
3. Concurrent duplicate processing is handled safely.
4. Do not use only an in-memory Set.
5. Add tests for sequential and concurrent duplicates.
```

---

# 20. Phase 17 — Cosmos TTL

## Goal

Learn automatic expiration for ephemeral documents.

Good candidates:

```text
processed-event
short-lived state
temporary cache-like data
```

## Cursor Prompt

```text
Implement Phase 17 only.

Add a Cosmos TTL strategy.

Requirements:
1. Apply TTL to processed-event documents as the main example.
2. Make TTL configurable.
3. Do not apply the same TTL blindly to business orders.
4. Document when TTL is appropriate.
5. Add a controlled test/demo.
```

---

# 21. Phase 18 — Service Bus Sessions and Ordering

Use:

```text
sessionId = orderId
```

## Cursor Prompt

```text
Implement Phase 18 only.

Add Service Bus sessions to the appropriate subscription.

Requirements:
1. sessionId = orderId
2. use a session-aware receiver
3. preserve per-order event ordering
4. allow different orders to process concurrently
5. keep idempotency enabled
6. add a demo for order-1001 and order-1002
7. configure session lock renewal where appropriate
8. explain why sessions do not provide global ordering
```

---

# 22. Phase 19 — Scheduled Messages

## Cursor Prompt

```text
Implement Phase 19 only.

Add:
POST /orders/:id/reminder

Schedule an OrderReminder event.

Requirements:
- use a short development delay
- include orderId and correlationId
- Notification Service consumes it
- add tests
- document scheduled delivery
```

---

# 23. Phase 20 — Subscription Filters

## Cursor Prompt

```text
Implement Phase 20 only.

Add Service Bus subscription filters.

Use an application property such as:
notificationType=email|sms

Requirements:
- configure at least two routing scenarios
- prove irrelevant messages are not delivered to the wrong logical consumer
- document when subscription filters are useful
```

---

# 24. Phase 21 — Cosmos Consistency

Learn the available consistency choices and how they affect the application.

## Cursor Prompt

```text
Implement Phase 21 only.

Create a Cosmos consistency learning document/demo.

Cover:
- strong
- bounded staleness
- session
- consistent prefix
- eventual

Explain:
1. which level this project uses
2. why
3. what eventual consistency means for an event-driven architecture
4. which reads are business-critical
5. which reads tolerate staleness

Do not change production consistency without documenting the trade-off.
```

---

# 25. Phase 22 — RU Consumption

## Cursor Prompt

```text
Implement Phase 22 only.

Create a Cosmos performance experiment.

Measure/observe where practical:
- point read charge
- create charge
- replace charge
- query charge
- cross-partition query behavior

Document the observations.
Do not invent benchmark results.
```

---

# 26. Phase 23 — Hot Partition Experiment

## Cursor Prompt

```text
Implement Phase 23 only.

Create a controlled partition-key experiment.

Scenario A:
Many operations concentrated on one logical partition.

Scenario B:
Operations spread across many orderIds.

Compare behavior and metrics.

Explain:
- hot partitions
- traffic distribution
- transaction boundaries
- why a partition key can be technically valid but operationally poor

Do not change the main project's partition key in this experiment.
```

---

# 27. Phase 24 — Retry Strategy

## Cursor Prompt

```text
Implement Phase 24 only.

Define transient vs permanent failures.

Transient:
- temporary Service Bus failure
- temporary downstream availability issue

Permanent:
- invalid event contract
- impossible business operation

Implement:
- bounded retries
- useful error metadata
- DLQ for poison/permanent messages
- outbox remains unpublished after failed send
- tests for transient and permanent failures
```

---

# 28. Phase 25 — Concurrency and Prefetch

## Cursor Prompt

```text
Implement Phase 25 only.

Make Service Bus consumer concurrency and prefetch configurable.

Test:
concurrency = 1, 3, 10
prefetch = 0, 10, 50

Measure:
- throughput
- processing latency
- failures
- backlog

Document:
- concurrency vs throughput
- prefetch vs lock duration
- why long-running handlers require care
- why idempotency remains necessary
```

---

# 29. Phase 26 — Failure Injection

## Cursor Prompt

```text
Implement Phase 26 only.

Add development/test-only failure injection for:
- transient payment failure
- permanent payment failure
- inventory failure
- artificial processing delay
- Service Bus publish failure
- Cosmos transient error simulation where practical

Requirements:
- disabled by default
- never enabled in production
- configurable
- tests for retries/DLQ/idempotency
```

---

# 30. Phase 27 — Redis

## Cursor Prompt

```text
Implement Phase 27 only.

Add Redis for one clear use case, such as product caching.

Requirements:
- NestJS provider
- configuration
- TTL
- cache hit/miss logging
- invalidation documentation

Do not use Redis as the durable source of truth for orders or payments.
```

---

# 31. Phase 28 — Observability

Every log should contain:

```text
service
messageId
eventId
correlationId
orderId
eventType
timestamp
```

## Cursor Prompt

```text
Implement Phase 28 only.

Add structured logging and basic metrics.

Track:
- messages received
- messages completed
- messages abandoned
- DLQ count
- retries
- Service Bus publish failures
- outbox backlog
- outbox publish latency
- duplicate events
- Cosmos request charge where practical
- processing latency

Keep the implementation simple and portable.
```

---

# 32. Phase 29 — Docker

Run local application services with:

```text
docker compose
   |
   +-- Redis
   +-- order-service
   +-- payment-service
   +-- inventory-service
   +-- notification-service
   +-- outbox-publisher
```

Cosmos DB and Service Bus remain real Azure dependencies.

## Cursor Prompt

```text
Implement Phase 29 only.

Create Docker Compose for local application services.

Requirements:
- Redis
- NestJS services
- outbox publisher
- health checks
- environment variables
- no secrets in repository
- clear README commands
- Cosmos DB and Service Bus remain external Azure dependencies
```

---

# 33. Phase 30 — Azure Infrastructure

Target:

```text
Resource Group
 |
 +-- Cosmos DB Account
 |      |
 |      +-- ecommerce database
 |              |
 |              +-- orders container
 |
 +-- Service Bus Namespace
 |      |
 |      +-- orders-topic
 |              |
 |              +-- payment-subscription
 |              +-- inventory-subscription
 |              +-- notification-subscription
 |
 +-- Redis
 |
 +-- Container Apps Environment
```

## Cursor Prompt

```text
Implement Phase 30 only.

Create Azure infrastructure documentation/scripts for:
- Resource Group
- Cosmos DB account
- ecommerce database
- orders container
- Service Bus namespace
- orders topic
- subscriptions
- Redis
- Container Apps environment

Requirements:
- no secrets in code
- document /orderId partition key
- document RBAC requirements
- identify manual values I must provide
- use current official Azure CLI/documentation when exact syntax is needed
```

---

# 34. Phase 31 — Managed Identity and RBAC

Target:

```text
Container App
      |
Managed Identity
      |
      +--> Cosmos DB
      +--> Service Bus
```

## Cursor Prompt

```text
Implement Phase 31 only.

Document and configure passwordless Azure authentication.

Requirements:
1. local developer authentication
2. production managed identity
3. RBAC for Cosmos DB
4. RBAC for Service Bus
5. no production secrets where managed identity can be used
6. keep local development practical
7. add a security checklist
```

---

# 35. Phase 32 — Container Apps Deployment

## Cursor Prompt

```text
Implement Phase 32 only.

Prepare deployment for Azure Container Apps.

Deploy:
- order-service
- payment-service
- inventory-service
- notification-service
- outbox-publisher

Requirements:
- production Docker images
- environment configuration
- health/readiness behavior
- managed identity
- Cosmos connectivity
- Service Bus connectivity
- Redis connectivity
- scaling configuration
- rollback instructions
- troubleshooting guide

Do not invent secrets or resource IDs.
```

---

# 36. Phase 33 — Load Testing

Use a tool such as k6.

## Cursor Prompt

```text
Implement Phase 33 only.

Create load-testing scenarios.

Measure:
- API throughput
- Cosmos request charge
- Service Bus backlog
- message processing throughput
- processing latency
- duplicate handling
- DLQ count
- outbox backlog
- CPU/memory
- Redis behavior

Make test volume and concurrency configurable.
Do not claim performance numbers without running the tests.
```

---

# 37. Phase 34 — Failure Testing

Run manually:

## A. Transactional batch failure

```text
Create Order
+
Create Outbox
     |
     X
failure
```

Verify the batch does not leave only one operation committed.

## B. Service Bus unavailable

```text
Cosmos transaction succeeds
       |
Change Feed
       |
Service Bus send fails
       |
outbox remains pending
       |
retry
```

## C. Duplicate event

```text
OrderCreated
OrderCreated
```

Expected:

```text
one business effect
```

## D. Consumer crash

Stop Payment Service while processing.

Expected redelivery behavior should be observable.

## E. Slow consumer

Artificially delay processing and observe lock renewal/redelivery/DLQ behavior.

---

# 38. Phase 35 — Final End-to-End Order Workflow

```text
POST /orders
      |
      v
Cosmos Transactional Batch
      |
      +--> Order
      +--> OutboxEvent
              |
              v
       Cosmos Change Feed
              |
              v
       Outbox Publisher
              |
              v
       Orders Topic
          /     |     \
         v      v      v
     Payment Inventory Notification
        |        |         |
        v        v         v
     Payment  Inventory  Email/SMS
    Completed  Reserved
        \        /
         \      /
          v    v
        OrderConfirmed
```

---

# 39. Cosmos Data Model

Start with one container:

```text
Database: ecommerce
Container: orders
Partition key: /orderId
```

Use a `type` discriminator:

```text
order
outbox
processed-event
```

### Order

```json
{
  "id": "order-1001",
  "type": "order",
  "orderId": "order-1001",
  "userId": "user-100",
  "status": "PENDING",
  "items": [],
  "totalAmount": 1000
}
```

### Outbox

```json
{
  "id": "outbox-1001",
  "type": "outbox",
  "orderId": "order-1001",
  "eventId": "evt-1001",
  "eventType": "OrderCreated",
  "status": "PENDING",
  "payload": {},
  "createdAt": "2026-09-20T10:00:00Z",
  "publishedAt": null,
  "attempts": 0,
  "lastError": null
}
```

### Processed event

```json
{
  "id": "payment:evt-1001",
  "type": "processed-event",
  "orderId": "order-1001",
  "consumer": "payment-service",
  "eventId": "evt-1001",
  "processedAt": "2026-09-20T10:00:00Z",
  "ttl": 604800
}
```

---

# 40. Service Bus Data Model

```text
orders-topic
  |
  +-- payment-subscription
  +-- inventory-subscription
  +-- notification-subscription
```

Example message:

```json
{
  "messageId": "evt-1001",
  "subject": "OrderCreated",
  "sessionId": "order-1001",
  "applicationProperties": {
    "eventType": "OrderCreated",
    "version": 1,
    "correlationId": "order-1001"
  },
  "body": {
    "eventId": "evt-1001",
    "eventType": "OrderCreated",
    "version": 1,
    "occurredAt": "2026-09-20T10:00:00Z",
    "correlationId": "order-1001",
    "data": {}
  }
}
```

---

# 41. Cosmos Topics You Must Understand

By the end, you should be able to explain:

```text
Database
Container
Item
Partition key
Logical partition
Point read
Query
Request Units
ETag
Optimistic concurrency
TTL
Transactional Batch
Change Feed
Consistency
Indexing
Hot partition
```

---

# 42. Service Bus Topics You Must Understand

```text
Namespace
Queue
Topic
Subscription
Message
Message properties
Peek-lock
Complete
Abandon
Dead-letter
TTL
Max delivery count
Lock duration
Lock renewal
Sessions
Ordering
Scheduled messages
Filters
Duplicate detection
Prefetch
Concurrency
```

---

# 43. Final Interview Questions

You should be able to answer:

### Cosmos DB

1. Why did you choose `/orderId` as partition key?
2. When is a point read better than a query?
3. What is a logical partition?
4. What causes a hot partition?
5. How does Cosmos DB optimistic concurrency work?
6. What is RU consumption?
7. What does TTL do?
8. What is Transactional Batch?
9. Why are transactional operations scoped to a partition?
10. What is Change Feed?
11. How does Change Feed help the Outbox pattern?
12. What consistency model does your system use and why?

### Service Bus

13. Queue vs topic?
14. What is peek-lock?
15. What happens if a consumer crashes before completing a message?
16. When should you abandon vs dead-letter?
17. What is a DLQ?
18. How do sessions preserve per-order ordering?
19. How do you make a consumer idempotent?
20. Why can duplicate messages still happen?
21. How do retries interact with lock duration?
22. What is prefetch?
23. How do you scale consumers?
24. How do scheduled messages work?
25. How do subscription filters work?

### Architecture

26. Why not publish directly from POST /orders?
27. Why use an Outbox document?
28. What if Service Bus is down?
29. What if the publisher crashes after Service Bus succeeds but before Cosmos marks the outbox published?
30. How does idempotency protect against that case?
31. How would you process 1 million orders?
32. What would you monitor?
33. What would you change for multi-region deployment?

---

# 44. Cursor Debug Prompt

Use this instead of asking Cursor to "fix everything":

```text
Debug only the issue below.

Problem:
<error>

Expected:
<expected>

Actual:
<actual>

Requirements:
- preserve current architecture
- inspect installed package versions/types
- use current official Azure documentation when API behavior is uncertain
- change only necessary files
- explain root cause
- add a regression test
- do not upgrade packages unless required

Return:
1. root cause
2. exact fix
3. changed files
4. tests run
5. remaining risk
```

---

# 45. Cursor Architecture Review Prompt

```text
Review the current implementation for the phase just completed.

Check:
1. Cosmos data model
2. partition-key correctness
3. Transactional Batch usage
4. Change Feed usage
5. Service Bus SDK usage
6. settlement behavior
7. retry behavior
8. idempotency
9. logging
10. security
11. test coverage
12. unnecessary coupling
13. production risks

Do not rewrite the project.

Return:
- critical issues
- medium issues
- minor issues
- recommended fixes
```

---

# 46. Cursor Learning Prompt

```text
Teach me the Azure concept implemented in this phase.

Phase:
<phase>

Explain:
1. what it is
2. why we need it
3. what happens at a high level
4. failure scenarios
5. what happens to the document/message on failure
6. how it differs from PostgreSQL/Redis/HTTP
7. what an interviewer may ask
8. one experiment I can run

Do not generate unrelated code.
```

---

# 47. 30-Day Execution Plan

## Week 1 — Cosmos foundation

```text
Day 1  Bootstrap
Day 2  Cosmos connection/container
Day 3  Order document/repository
Day 4  Order API
Day 5  Point reads vs queries/RU
Day 6  ETags/concurrency
Day 7  Review + tests
```

## Week 2 — Service Bus foundation

```text
Day 8   Queue
Day 9   Producer/consumer
Day 10  Peek-lock/settlement
Day 11  Retry
Day 12  DLQ
Day 13  Topic
Day 14  Subscriptions
```

## Week 3 — Event-driven architecture

```text
Day 15  Separate services
Day 16  Payment events
Day 17  Inventory events
Day 18  Transactional Batch
Day 19  Cosmos Outbox
Day 20  Change Feed publisher
Day 21  Idempotency
```

## Week 4 — Advanced Azure

```text
Day 22  Sessions/order
Day 23  Scheduled messages
Day 24  Subscription filters
Day 25  TTL
Day 26  Consistency
Day 27  RU + partition experiments
Day 28  Redis
Day 29  Observability + Docker
Day 30  Azure deployment + failure testing
```

---

# 48. Milestones

## Milestone 1 — Cosmos

```text
[ ] NestJS
[ ] Cosmos account/container
[ ] /orderId partition key
[ ] Order document
[ ] Order API
[ ] Point reads
[ ] Queries
[ ] RU awareness
[ ] ETags
```

## Milestone 2 — Service Bus

```text
[ ] Queue
[ ] Producer
[ ] Consumer
[ ] Peek-lock
[ ] Complete
[ ] Abandon
[ ] Retry
[ ] DLQ
```

## Milestone 3 — Pub/Sub

```text
[ ] Orders topic
[ ] Payment subscription
[ ] Inventory subscription
[ ] Notification subscription
[ ] Separate services
```

## Milestone 4 — Reliability

```text
[ ] Transactional Batch
[ ] Outbox
[ ] Change Feed publisher
[ ] Idempotency
[ ] TTL
[ ] Retry policy
```

## Milestone 5 — Advanced messaging

```text
[ ] Sessions
[ ] Per-order ordering
[ ] Scheduled messages
[ ] Filters
[ ] Concurrency
[ ] Prefetch
```

## Milestone 6 — Production

```text
[ ] Redis
[ ] Structured logs
[ ] Correlation IDs
[ ] Metrics
[ ] Docker
[ ] Managed identity
[ ] Azure deployment
[ ] Load tests
[ ] Failure tests
```

---

# 49. Definition of Done

```text
[ ] Create orders in Cosmos DB
[ ] Explain partition key
[ ] Perform point reads
[ ] Perform queries
[ ] Understand RU consumption
[ ] Use ETags
[ ] Use Transactional Batch
[ ] Persist Outbox events
[ ] Consume Cosmos Change Feed
[ ] Publish Service Bus events
[ ] Consume from topics/subscriptions
[ ] Use peek-lock
[ ] Complete messages
[ ] Abandon messages
[ ] Retry failures
[ ] Inspect DLQ
[ ] Reprocess DLQ messages
[ ] Handle duplicate delivery
[ ] Use idempotent consumers
[ ] Use Service Bus sessions
[ ] Preserve per-order ordering
[ ] Schedule messages
[ ] Use subscription filters
[ ] Use TTL appropriately
[ ] Understand Cosmos consistency
[ ] Understand hot partitions
[ ] Use Redis appropriately
[ ] Add observability
[ ] Run load tests
[ ] Perform failure tests
[ ] Deploy to Azure
[ ] Use managed identity
[ ] Explain the architecture in an interview
```

---

# 50. First Cursor Prompt

Start here and do not skip ahead:

```text
Read the project rules below.

You are helping me build an Azure-native event-driven e-commerce learning project.

Tech stack:
- NestJS
- TypeScript
- Azure Cosmos DB for NoSQL
- Azure Service Bus
- Redis
- Docker
- Jest
- @azure/cosmos
- @azure/service-bus
- @azure/identity

Do NOT use PostgreSQL.
Do NOT use Prisma.

Implement PHASE 1 ONLY.

Phase 1:
Bootstrap a clean NestJS TypeScript application.

Requirements:
- strict TypeScript
- ESLint
- Prettier
- Jest
- environment configuration
- GET /health
- .env.example

Do not add:
- Cosmos DB
- Service Bus
- Redis
- Docker
- microservices

Before modifying files:
1. inspect the repository
2. tell me what you found
3. identify files you will create/change

Then implement.

After implementation:
1. show changed files
2. show commands to run
3. show expected output
4. run tests/build if possible
5. list what I should verify manually
6. explain the concepts introduced
```

---

# 51. Official Documentation Checkpoints

When Cursor needs API-level verification, prefer current Microsoft documentation for:

- Azure Cosmos DB for NoSQL
- Azure Cosmos DB Node.js SDK
- Cosmos DB Transactional Batch
- Cosmos DB Change Feed
- Azure Service Bus JavaScript SDK
- Service Bus sessions
- Service Bus dead-lettering
- Azure Identity / managed identity

Current Microsoft documentation confirms that the JavaScript Service Bus SDK supports senders/receivers, peek-lock settlement, sessions, and dead-letter workflows. Current Cosmos documentation supports the Node.js Change Feed pull model and does not list the dedicated Change Feed Processor library as supported for Node.js.

---

# 52. The Learning Rule

Do not measure progress by how much code Cursor generated.

Measure progress by whether you can answer:

```text
Where is the data?

What is the partition key?

Why is this the transaction boundary?

What happens when a document is written?

How does the change feed become a Service Bus event?

What happens if Service Bus is unavailable?

What happens if the publisher crashes after sending?

What happens if the consumer sees the same event twice?

Why did this message go to DLQ?

How is per-order ordering preserved?

How does the system scale?
```

That is the real outcome of the project.
