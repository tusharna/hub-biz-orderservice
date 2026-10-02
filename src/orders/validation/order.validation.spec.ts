import { BadRequestException } from '@nestjs/common';
import {
  calculateOrderTotalAmount,
  validateCreateOrderInput,
} from './order.validation';

describe('order.validation', () => {
  describe('calculateOrderTotalAmount', () => {
    it('sums quantity × price for all items', () => {
      expect(
        calculateOrderTotalAmount([
          { productId: 'p1', quantity: 2, price: 500 },
          { productId: 'p2', quantity: 1, price: 250 },
        ]),
      ).toBe(1250);
    });
  });

  describe('validateCreateOrderInput', () => {
    it('accepts valid input', () => {
      expect(() =>
        validateCreateOrderInput({
          userId: 'user-100',
          items: [{ productId: 'product-100', quantity: 2, price: 500 }],
        }),
      ).not.toThrow();
    });

    it('rejects empty userId', () => {
      expect(() =>
        validateCreateOrderInput({
          userId: '  ',
          items: [{ productId: 'p', quantity: 1, price: 1 }],
        }),
      ).toThrow(BadRequestException);
    });

    it('rejects empty items array', () => {
      expect(() =>
        validateCreateOrderInput({ userId: 'user-1', items: [] }),
      ).toThrow(BadRequestException);
    });

    it('rejects invalid quantity', () => {
      expect(() =>
        validateCreateOrderInput({
          userId: 'user-1',
          items: [{ productId: 'p', quantity: 0, price: 10 }],
        }),
      ).toThrow(BadRequestException);
    });
  });
});
