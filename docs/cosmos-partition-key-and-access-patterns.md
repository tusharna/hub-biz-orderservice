# Cosmos DB — partition key and access patterns (Phase 2)

This project stores orders in a single container with partition key path **`/orderId`**.

## Partition key

The **partition key** is a property path on each document (here: `orderId`). Cosmos DB uses it to decide **which physical partition** stores the item.

- Container setting: partition key path `/orderId`
- Every document must include `orderId`, and it should be stable for the life of that order
- The **partition key value** you pass to reads/writes is the document’s `orderId` string (not the path `/orderId`)

## Logical partition

A **logical partition** is the set of items that share the same partition key value (e.g. all documents where `orderId = "order-1001"` — typically one order document in our model).

Operations such as **transactional batch** (later phases) are scoped to a **single logical partition**. That is why we colocate an order and its outbox event under the same `orderId`.

## Point read

A **point read** fetches one item by **document id** and **partition key value** with a direct lookup (lowest RU cost, lowest latency):

```text
container.item(id, orderId).read()
```

Both `id` and `orderId` are required. Guessing only `id` without the partition key is not a point read.

## Query

A **query** uses SQL over items in the container (or a single partition when you set `partitionKey` on the request). Queries scan index entries and cost more RUs than a point read, especially cross-partition queries.

Example (same partition):

```sql
SELECT * FROM c WHERE c.orderId = @orderId AND c.status = @status
```

Prefer point reads when you know `id` + `orderId`; use queries for lists, filters, or reporting.

## Why `/orderId` for this learning project

1. **Natural domain key** — Each order is processed as a unit; `orderId` identifies that unit end-to-end.
2. **Future transactional batch** — Order + outbox event will be written atomically in one logical partition (same `orderId`).
3. **Service Bus sessions / ordering** (later) — Per-order workflows map cleanly to per-order storage.
4. **Teaches explicit access patterns** — You must pass `orderId` on reads/writes, which mirrors how Cosmos differs from relational “query by primary key only” habits.

Alternative designs (e.g. partition by `userId`) trade off hot partitions vs. cross-partition queries; `orderId` is a deliberate teaching choice for order-centric processing.
