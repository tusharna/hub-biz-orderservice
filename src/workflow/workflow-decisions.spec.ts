import {
  decideInventoryOutcome,
  decidePaymentOutcome,
  nextOrderStatus,
} from './workflow-decisions';

describe('workflow decisions', () => {
  it('fails payment only for the deterministic user suffix', () => {
    expect(decidePaymentOutcome({ userId: 'user-100' })).toBe('completed');
    expect(decidePaymentOutcome({ userId: 'user-100-pay-fail' })).toBe(
      'failed',
    );
    expect(decidePaymentOutcome({ userId: 'user-100', force: 'failed' })).toBe(
      'failed',
    );
  });

  it('fails inventory when a product id is out of stock', () => {
    expect(decideInventoryOutcome({ productIds: ['product-100'] })).toBe(
      'reserved',
    );
    expect(decideInventoryOutcome({ productIds: ['product-100-oos'] })).toBe(
      'failed',
    );
  });

  it('confirms the order only after payment and inventory succeed', () => {
    expect(
      nextOrderStatus('PENDING', {
        payment: 'completed',
        inventory: 'reserved',
      }),
    ).toBe('CONFIRMED');
    expect(nextOrderStatus('PENDING', { payment: 'failed' })).toBe('FAILED');
  });
});
