import { ORDER_CREATED_EVENT_TYPE } from './event-types.constants';
import type { EventEnvelope } from './event-envelope.types';
import type { OrderCreatedData } from './order-created.event';

export function isEventEnvelope(
  value: unknown,
): value is EventEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.eventId === 'string' &&
    typeof record.eventType === 'string' &&
    typeof record.version === 'number' &&
    typeof record.occurredAt === 'string' &&
    typeof record.correlationId === 'string' &&
    'data' in record
  );
}

export function isOrderCreatedEnvelope(
  value: unknown,
): value is EventEnvelope<OrderCreatedData> {
  if (!isEventEnvelope(value)) {
    return false;
  }
  if (value.eventType !== ORDER_CREATED_EVENT_TYPE) {
    return false;
  }
  const data = value.data as Record<string, unknown>;
  return (
    typeof data.orderId === 'string' &&
    typeof data.userId === 'string' &&
    typeof data.status === 'string' &&
    typeof data.totalAmount === 'number' &&
    typeof data.itemCount === 'number' &&
    Array.isArray(data.items) &&
    data.items.every(isOrderCreatedLine)
  );
}

function isOrderCreatedLine(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const line = value as Record<string, unknown>;
  return (
    typeof line.productId === 'string' &&
    line.productId.trim().length > 0 &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity >= 1
  );
}
