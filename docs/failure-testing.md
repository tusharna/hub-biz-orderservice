# Failure testing

Run these against a dev namespace. Do not enable failure switches in production.

## A. Batch failure

Unit test: `executePartitionBatch` throws when any operation status is >= 400, and `publishOutboxDocument` is not called from `POST /orders`. If the batch throws, neither document is committed by Cosmos.

## B. Service Bus unavailable

`publishOutboxDocument` test: send rejects, status stays `PENDING`, `attempts` increments, `publishedAt` stays null. Restart the outbox publisher to retry.

## C. Duplicate event

`claimProcessedEvent` concurrent test: one claim wins, the other returns `duplicate`.

## D. Consumer crash

Stop the payment process during handling. Peek-lock expiry redelivers. `deliveryCount` increases. The processed-event document prevents a second business effect after the first claim.

For inventory, stop the Inventory app after it has saved a reservation document. Redelivery republishes `InventoryReserved` or `InventoryReservationFailed` and does not decrement stock again. That behavior is covered by `ReservationService` unit tests in the Inventory app.

## E. Slow consumer

Set `SERVICE_BUS_SIMULATE_TRANSIENT_FAILURE=true` or lower the lock duration in Azure. Observe abandon, redelivery, then dead-letter after max delivery count. Peek with `GET /admin/dead-letter-messages`.
