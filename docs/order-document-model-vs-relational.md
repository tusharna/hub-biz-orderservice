# Order document model vs relational schema

This project stores orders in **one Cosmos DB document** per order. A traditional relational design would split the same data across multiple normalized tables.

## Relational approach (what we are *not* doing in Phase 3)

```text
orders                    order_items
--------                  -------------
id (PK)                   id (PK)
user_id (FK)              order_id (FK → orders.id)
status                    product_id
total_amount              quantity
created_at                price
updated_at
```

Typical access:

- `INSERT` into `orders`, then `INSERT` many rows into `order_items` inside a **SQL transaction**
- `SELECT` order header + `JOIN order_items` to load one order
- `UPDATE orders SET status = … WHERE id = …`

The database enforces foreign keys, constraints, and ACID transactions across tables.

## Document approach (this project)

One JSON document in the `orders` container:

```json
{
  "id": "order-1001",
  "type": "order",
  "orderId": "order-1001",
  "userId": "user-100",
  "status": "PENDING",
  "items": [
    { "productId": "product-100", "quantity": 2, "price": 500 }
  ],
  "totalAmount": 1000,
  "createdAt": "...",
  "updatedAt": "..."
}
```

| Aspect | Relational | Cosmos document (this phase) |
|--------|------------|------------------------------|
| Structure | Header + child rows in separate tables | **Nested array** `items[]` inside one document |
| Load one order | JOIN or two queries | **Single point read** (`id` + `orderId`) |
| Partitioning | Often by primary key / shard key in app | **Explicit partition key** `/orderId` on every access |
| Schema | Fixed columns + migrations | Flexible JSON; app validates shape |
| Totals | Can be computed in SQL or app | **`totalAmount` calculated in app** and stored on the document |
| Related entities | FK relationships | Later: other **document types** in same container (`outbox`, `processed-event`) sharing `orderId` |

## Why embed `items` instead of a separate container?

For order processing, line items are **always read and written with the order**. Embedding avoids cross-partition joins and matches a **single logical partition per order** (`orderId`), which later enables **transactional batch** (order + outbox in one partition).

Trade-off: you cannot query “all orders containing product X” as cheaply as a normalized `order_items` table without a separate indexing/access pattern. That is an intentional teaching point—Cosmos rewards **access-pattern-first** modeling.

## Code layout in this repo

```text
src/orders/
  domain/           # Order, OrderItem types
  validation/       # Input rules + totalAmount calculation
  repositories/     # OrderRepository port + CosmosOrderRepository
  order.service.ts  # createOrder, getOrder, updateOrderStatus
```

Phase 4 will expose HTTP; Phase 3 keeps persistence and business logic testable without controllers.
