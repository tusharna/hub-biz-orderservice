import { BadRequestException } from '@nestjs/common';
import type {
  CreateOrderInput,
  CreateOrderItemInput,
  OrderItem,
} from '../domain/order.types';

function assertNonEmptyString(value: string, fieldName: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${fieldName} must be a non-empty string.`);
  }
}

function validateOrderItemInput(
  item: CreateOrderItemInput,
  index: number,
): void {
  assertNonEmptyString(item.productId, `items[${index}].productId`);
  if (!Number.isInteger(item.quantity) || item.quantity < 1) {
    throw new BadRequestException(
      `items[${index}].quantity must be an integer greater than 0.`,
    );
  }
  if (
    typeof item.price !== 'number' ||
    Number.isNaN(item.price) ||
    item.price < 0
  ) {
    throw new BadRequestException(
      `items[${index}].price must be a number greater than or equal to 0.`,
    );
  }
}

export function validateCreateOrderInput(input: CreateOrderInput): void {
  assertNonEmptyString(input.userId, 'userId');
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new BadRequestException('items must contain at least one line item.');
  }
  input.items.forEach((item, index) => validateOrderItemInput(item, index));
}

/** Server-side total: sum(quantity × price) for all line items. */
export function calculateOrderTotalAmount(items: OrderItem[]): number {
  return items.reduce((total, item) => total + item.quantity * item.price, 0);
}
