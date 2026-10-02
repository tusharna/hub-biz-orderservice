# How to run

You need Node.js, an Azure Cosmos account, and an Azure Service Bus namespace (Standard, so topics exist). Redis is optional for a single-process run. Stock reservation needs the Inventory app running as well.

## First time

```bash
npm install
cp .env.example .env
```

Fill `.env` from the Azure portal. Do not commit `.env`. The example names are:

- Cosmos: `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE=ecommerce`, `COSMOS_ORDERS_CONTAINER=orders`
- Service Bus: `SERVICE_BUS_CONNECTION_STRING`, `SERVICE_BUS_ORDERS_QUEUE=orders-queue`
- Topic, required for the Inventory app: `SERVICE_BUS_ORDERS_TOPIC=orders-topic`

`infra/azure/create-resources.sh` can create the resource group, the orders container (`/orderId`, TTL enabled), the queue, the topic, subscriptions `payment-subscription`, `inventory-subscription`, and `notification-subscription`, Redis, and a Container Apps environment. Edit the names at the top of that script before you run it. It does not print keys into the repo. After it finishes, copy the endpoint and connection string into `.env` yourself. The Inventory app creates the `stock` container on startup when those Cosmos values are set.

The orders page is `http://localhost:3000/` after the API is up.

## One process

```bash
npm run start:dev
```

The API listens on `PORT` (default `3000`). Health check:

```bash
curl http://localhost:3000/health
```

Create an order:

```bash
curl -s -X POST http://localhost:3000/orders \
  -H 'content-type: application/json' \
  -d '{"userId":"user-1","items":[{"productId":"sku-1","quantity":1,"price":10}]}'
```

Seed `sku-1` in the Inventory app before you expect a reservation to succeed. See that app's README.

## Split processes

Use a different `PORT` for each HTTP process if you start them on one machine. Only `order-service` needs to be reachable for `POST /orders`.

```bash
APP_ROLE=order-service OUTBOX_PUBLISHER_ENABLED=false PORT=3000 npm run start:dev
APP_ROLE=outbox-publisher OUTBOX_PUBLISHER_ENABLED=true SERVICE_BUS_CONSUMER_ENABLED=false npm run start:dev
APP_ROLE=payment-service npm run start:dev
APP_ROLE=notification-service npm run start:dev
```

Do not start `APP_ROLE=inventory-service` for stock. That process does not join `inventory-subscription`. Run the Inventory app instead, on port `3001`.

Fan-out in this repo starts when `SERVICE_BUS_ORDERS_TOPIC` is set and `APP_ROLE` is `payment-service` or `notification-service`.

## Docker

`docker compose up --build` starts Redis plus `order-service`, `payment-service`, `notification-service`, and `outbox-publisher`. It does not start an inventory container. Cosmos and Service Bus stay in Azure. Compose reads `.env` and overrides `APP_ROLE` and `REDIS_URL` per service. Only `order-service` publishes port `3000`.

## Tests and load

```bash
npm test
npm run test:e2e
```

`load/k6-orders.js` posts orders. Set `BASE_URL`, `VUS`, and `DURATION` when you run k6. It does not store a report by itself.

## Useful flags

| Variable | Effect |
| --- | --- |
| `SERVICE_BUS_CONSUMER_ENABLED=false` | API without a queue consumer in this process |
| `OUTBOX_PUBLISHER_ENABLED=false` | Do not poll the outbox here |
| `SERVICE_BUS_SIMULATE_TRANSIENT_FAILURE=true` | Dev only. Abandons queue messages so you can watch redelivery. Ignored when `NODE_ENV=production` |
| `SERVICE_BUS_SESSIONS_ENABLED=true` | Publishes with `sessionId` equal to the order id |
| `ORDER_REMINDER_DELAY_SECONDS` | Delay for `POST /orders/:id/reminder` (default 15) |
| `REDIS_URL` | Use Redis for product names. Empty means in-memory cache |
| `PRODUCT_CACHE_TTL_SECONDS` | Product name cache lifetime (default 60) |
