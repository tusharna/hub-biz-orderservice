# Project notes

Start here when you come back to this repo. These files describe the orders app as it runs now. Stock reservation lives in the sibling Inventory app.

## Read in this order

1. [Overview](overview.md) — what this app does, and where inventory sits.
2. [How to run](how-to-run.md) — local start, env vars, Docker, and tests.
3. [Walkthrough](walkthrough.md) — folders, HTTP routes, and what happens after `POST /orders`.

## Deeper notes

| File | What it covers |
| --- | --- |
| [phases-09-35.md](phases-09-35.md) | Dead letter, topic fan-out, outbox, idempotency, sessions, Redis, metrics, Docker, Azure |
| [cosmos-partition-key-and-access-patterns.md](cosmos-partition-key-and-access-patterns.md) | Why orders are partitioned by `orderId` |
| [cosmos-ru-and-access-patterns.md](cosmos-ru-and-access-patterns.md) | Point reads vs queries and request units |
| [cosmos-optimistic-concurrency-etag.md](cosmos-optimistic-concurrency-etag.md) | ETag / If-Match updates |
| [order-document-model-vs-relational.md](order-document-model-vs-relational.md) | One order document vs tables |
| [service-bus-message-settlement.md](service-bus-message-settlement.md) | Complete, abandon, dead-letter |
| [failure-testing.md](failure-testing.md) | How to force failures and what to look for |

`azure-service-bus-cursor-execution.md` is the original build plan, not the operator guide.
