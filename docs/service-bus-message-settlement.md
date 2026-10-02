# Service Bus message settlement (Phase 8)

The orders queue consumer uses **peek-lock** (not receive-and-delete).

A peek-lock receive hides the message from other consumers and starts a lock timer. The message stays on the queue until the app **settles** it.

## receive → process → complete

```text
Service Bus queue
      |
      |  peek-lock receive (message locked, deliveryCount visible)
      v
processOrdersQueueMessage
      |
      |  log messageId, deliveryCount, correlationId, eventType
      |  handle OrderCreated (log payload)
      v
receiver.completeMessage()
      |
      v
message removed from the queue
```

**Complete** means processing succeeded. Service Bus will not deliver that message again.

## receive → fail → abandon → redelivery

```text
peek-lock receive
      |
      v
processing throws a transient failure
      |
      v
receiver.abandonMessage()
      |
      v
lock released immediately
      |
      v
message becomes available again
deliveryCount increments on the next receive
```

**Abandon** is for a temporary problem (timeout, dependency blip, the development failure switch). The same message comes back so the consumer can try again.

If abandon/complete never happens, the lock expires and Service Bus redelivers the same way. Explicit abandon makes that happen immediately.

This phase does **not** dead-letter. After the queue’s max delivery count, Azure moves the message to the dead-letter sub-queue (Phase 9).

## Development-only failure switch

```env
SERVICE_BUS_SIMULATE_TRANSIENT_FAILURE=true
```

Honored only when `NODE_ENV` is not `production`. Each received message is abandoned so you can watch `deliveryCount` increase in the logs, then set the flag back to `false` and restart so the next delivery completes.

## Code map

| Piece | Role |
|-------|------|
| `OrdersQueueConsumer` | `receiveMode: 'peekLock'`, `autoCompleteMessages: false` |
| `processOrdersQueueMessage` | Process, then complete or abandon |
| `settleAfterProcessing` | Calls `completeMessage` or `abandonMessage` |

SDK methods used (from `@azure/service-bus`): `ServiceBusClient.createReceiver`, `ServiceBusReceiver.subscribe`, `completeMessage`, `abandonMessage`.
