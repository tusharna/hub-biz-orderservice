import { ConflictException } from '@nestjs/common';

/** Raised when an If-Match write fails because the order changed in Cosmos. */
export class OrderConcurrencyConflictException extends ConflictException {
  constructor(orderId: string) {
    super(
      `Order "${orderId}" was updated by another process. Re-read the order and retry with the new etag.`,
    );
  }
}
