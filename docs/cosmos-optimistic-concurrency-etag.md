# Optimistic concurrency with Cosmos DB ETags (Phase 6)

Cosmos DB attaches an **_etag** (concurrency token) to every document. The SDK exposes it as **`etag`** on read/replace responses. Conditional writes use HTTP **If-Match** with that token.

## Read with ETag

```typescript
const { resource, etag } = await container.item(orderId, orderId).read();
```

In this project:

- `OrderRepository.findByOrderIdWithEtag()` → `{ order, etag }`
- `GET /orders/:id` returns the order **plus `etag`** for clients that will update status

## Conditional update (If-Match)

```typescript
await container.item(id, orderId).replace(body, {
  accessCondition: { type: 'IfMatch', condition: etagFromRead },
});
```

If another writer changed the document first, Cosmos returns **412 Precondition Failed**. The app maps that to **`OrderConcurrencyConflictException`** (**HTTP 409 Conflict**) with a message to re-read and retry.

API:

```http
PATCH /orders/:id/status
Content-Type: application/json

{
  "status": "PROCESSING",
  "etag": "<etag from GET>"
}
```

## Two writers, one stale etag

Typical race:

1. Writer A and B both read order etag **`v1`**
2. Writer A patches with **`If-Match: v1`** → success, etag becomes **`v2`**
3. Writer B patches with **`If-Match: v1`** → **412** → app returns **409 Conflict**

Try the learning endpoint (after creating an order and copying its etag):

```http
POST /learning/cosmos/concurrency/simulate-stale-writer
{
  "orderId": "order-…",
  "etag": "<current etag>",
  "firstStatus": "PROCESSING",
  "secondStatus": "PAID"
}
```

The response shows the successful first write and the **conflict error** for the stale second write.

## Why this matters for order state transitions

Order processing is a **workflow** (`PENDING` → `PROCESSING` → `PAID` → …). Multiple actors can touch the same order:

- API handler (`PATCH /orders/:id/status`)
- The Inventory app, on stock documents in the `stock` container (If-Match, one retry, then compensation)
- Retries and duplicate messages

Without concurrency control, **last write wins** and you can **lose valid transitions** (e.g. revert to `PENDING` after payment succeeded).

ETags give **optimistic concurrency**:

- No long-lived locks
- Conflicts surface as explicit **409** so callers **re-read** and decide (retry, abort, compensating action)
- Pairs naturally with **idempotent consumers** and Service Bus retries in later phases

This is especially important before **transactional batch + outbox**: you want status changes to be deliberate, not accidental overwrites.

## Code map

| Piece | Role |
|-------|------|
| `CosmosService.readItemByIdWithCharge` | Returns `etag` from point read |
| `CosmosService.replaceItemIfMatch` | If-Match replace |
| `CosmosOrderRepository.replaceIfMatch` | Maps 412 → `OrderConcurrencyConflictException` |
| `OrderService.updateOrderStatusIfMatch` | Business update + etag |
| `OrderService.simulateConcurrentStatusUpdates` | Two-writer demo |
