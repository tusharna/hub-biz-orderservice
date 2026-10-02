# Cosmos DB RU consumption and access patterns (Phase 5)

Azure Cosmos DB for NoSQL bills throughput in **request units (RUs)**. The Node.js SDK exposes the charge for each operation as **`requestCharge`** on the response (this project surfaces it as `requestChargeRu` in demo API responses).

RU cost depends on:

- **Operation type** (point read vs query vs write)
- **Document size** read or written
- **Index work** required
- **Partition scope** (single logical partition vs fan-out across many partitions)
- **Result count** (queries returning many rows cost more)

RU is a **per-request** metric. Compare charges across the learning endpoints on the same dataset to build intuition—not as absolute production SLAs.

---

## Point reads

A **point read** loads exactly one item when you know **`id` and partition key value`**.

In this project:

```text
container.item(orderId, orderId).read()
```

Characteristics:

- Targets **one logical partition** (partition key = `orderId`)
- Typically **~1 RU** for a small document (actual charge varies)
- Best choice when handling a known order by id

**Learning route:** `GET /learning/cosmos/access-patterns/point-read/:orderId`

---

## Queries

A **query** uses SQL (`SELECT … FROM c …`) over items in a container. The engine uses indexes but may scan more data than a point read.

Queries are appropriate when you need **filters, sorting, or lists**—for example “all orders for a user” or “all `PENDING` orders”.

**Learning routes:**

- `GET /learning/cosmos/access-patterns/by-user/:userId`
- `GET /learning/cosmos/access-patterns/by-status/:status`

Each response includes `requestChargeRu` and `resultCount`.

---

## Partition-local vs cross-partition access

| Term | Meaning in this project |
|------|-------------------------|
| **Logical partition** | All documents with the same `orderId` value |
| **Partition-local** | Operation touches **one** logical partition |
| **Cross-partition** | Operation may touch **many** logical partitions |

Because the container partition key is **`/orderId`**:

| Access | Partition scope | Why |
|--------|-----------------|-----|
| Point read by `orderId` | Partition-local | id + PK identify one partition |
| Query `WHERE userId = …` | **Cross-partition** | `userId` ≠ partition key |
| Query `WHERE status = …` | **Cross-partition** | `status` ≠ partition key |
| Query with `partitionKey: orderId` option | Partition-local | SDK limits execution to one partition |

**Contrast route:** `GET /learning/cosmos/access-patterns/partition-query/:orderId`  
Same filter on `orderId`, but executed as a **partition-scoped query** instead of a point read—useful to compare RU with `point-read` for the same order.

---

## Cross-partition queries

When the SDK is **not** given a partition key, Cosmos may **fan out** to all logical partitions in the container, merge results, and charge RUs accordingly.

Cross-partition queries are valid for:

- Admin dashboards
- Low-volume reporting
- Early development

They become costly at scale if used on hot paths. Production systems often add **purpose-built containers**, **composite indexes**, **materialized views**, or **change feed** pipelines instead of ad hoc cross-partition scans.

---

## Why partition-aware access matters

1. **Cost** — Cross-partition queries usually consume **more RUs** than point reads or partition-scoped operations.
2. **Latency** — Fan-out increases tail latency under load.
3. **Scale** — Hot partitions and inefficient queries show up as throttling (HTTP 429) when RU/s limits are hit.
4. **Future features in this repo** — **Transactional batch** and colocated **outbox** documents require operations in a **single logical partition** (`orderId`).

Design rule for this learning project: **know your partition key before you choose read vs query**, and prefer **point reads** on the order hot path.

---

## Try it locally

1. Create a few orders via `POST /orders` (different `userId` / statuses if you vary them later).
2. Call the learning endpoints and compare `requestChargeRu`:

```bash
curl -s "http://localhost:3000/learning/cosmos/access-patterns/point-read/<orderId>" | jq .
curl -s "http://localhost:3000/learning/cosmos/access-patterns/by-user/user-100" | jq .
curl -s "http://localhost:3000/learning/cosmos/access-patterns/by-status/PENDING" | jq .
curl -s "http://localhost:3000/learning/cosmos/access-patterns/partition-query/<orderId>" | jq .
```

Related docs: [cosmos-partition-key-and-access-patterns.md](./cosmos-partition-key-and-access-patterns.md)
