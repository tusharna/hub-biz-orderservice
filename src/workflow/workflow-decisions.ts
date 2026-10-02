export type PaymentOutcome = 'completed' | 'failed';
export type InventoryOutcome = 'reserved' | 'failed';

export function decidePaymentOutcome(input: {
  userId: string;
  force?: PaymentOutcome;
}): PaymentOutcome {
  if (input.force) {
    return input.force;
  }
  if (input.userId.endsWith('-pay-fail')) {
    return 'failed';
  }
  return 'completed';
}

export function decideInventoryOutcome(input: {
  productIds: string[];
  force?: InventoryOutcome;
}): InventoryOutcome {
  if (input.force) {
    return input.force;
  }
  if (input.productIds.some((id) => id.endsWith('-oos'))) {
    return 'failed';
  }
  return 'reserved';
}

export interface WorkflowState {
  payment?: PaymentOutcome;
  inventory?: InventoryOutcome;
}

export function nextOrderStatus(current: string, state: WorkflowState): string {
  if (state.payment === 'failed' || state.inventory === 'failed') {
    return 'FAILED';
  }
  if (state.payment === 'completed' && state.inventory === 'reserved') {
    return 'CONFIRMED';
  }
  if (state.payment === 'completed') {
    return 'PAID';
  }
  if (state.inventory === 'reserved') {
    return 'INVENTORY_RESERVED';
  }
  return current;
}
