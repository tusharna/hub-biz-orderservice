const STATUSES = [
  'PENDING',
  'PROCESSING',
  'PAYMENT_PENDING',
  'PAID',
  'INVENTORY_RESERVED',
  'CONFIRMED',
  'FAILED',
  'CANCELLED',
];

const banner = document.querySelector('#banner');
const itemsRoot = document.querySelector('#items');
const statusSelect = document.querySelector('#status');
const orderEmpty = document.querySelector('#order-empty');
const orderView = document.querySelector('#order-view');

for (const status of STATUSES) {
  const option = document.createElement('option');
  option.value = status;
  option.textContent = status;
  statusSelect.append(option);
}

function showError(error) {
  banner.hidden = false;
  banner.textContent = error instanceof Error ? error.message : String(error);
}

function clearError() {
  banner.hidden = true;
  banner.textContent = '';
}

async function api(path, options) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' ? body.message : body;
    const detail = Array.isArray(message) ? message.join(', ') : message;
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return body;
}

function addItemRow(item = { productId: 'sku-1', quantity: 1, price: 10 }) {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <label>Product id<input name="productId" required value="${item.productId}" /></label>
    <label>Qty<input name="quantity" type="number" min="1" step="1" required value="${item.quantity}" /></label>
    <label>Price<input name="price" type="number" min="0" step="0.01" required value="${item.price}" /></label>
    <button type="button" class="ghost remove">Remove</button>
  `;
  row.querySelector('.remove').addEventListener('click', () => {
    if (itemsRoot.children.length === 1) {
      return;
    }
    row.remove();
  });
  itemsRoot.append(row);
}

addItemRow();
document.querySelector('#add-item').addEventListener('click', () => addItemRow({ productId: '', quantity: 1, price: 0 }));

function renderOrder(order) {
  orderEmpty.hidden = true;
  orderView.hidden = false;
  document.querySelector('#order-id').value = order.orderId;
  document.querySelector('#etag').value = order.etag ?? '';
  statusSelect.value = order.status;
  const facts = document.querySelector('#order-facts');
  facts.replaceChildren();
  for (const [label, value] of [
    ['Order', order.orderId],
    ['User', order.userId],
    ['Status', order.status],
    ['Total', String(order.totalAmount)],
    ['Updated', order.updatedAt],
  ]) {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    facts.append(term, detail);
  }
  const list = document.querySelector('#order-items');
  list.replaceChildren();
  for (const item of order.items ?? []) {
    const line = document.createElement('li');
    line.textContent = `${item.productId} × ${item.quantity} @ ${item.price}`;
    list.append(line);
  }
}

async function loadOrder(orderId) {
  const order = await api(`/orders/${encodeURIComponent(orderId)}`);
  renderOrder(order);
  return order;
}

document.querySelector('#create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const form = event.currentTarget;
  const items = [...itemsRoot.querySelectorAll('.item-row')].map((row) => ({
    productId: row.querySelector('[name="productId"]').value.trim(),
    quantity: Number(row.querySelector('[name="quantity"]').value),
    price: Number(row.querySelector('[name="price"]').value),
  }));
  try {
    const created = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({
        userId: form.userId.value.trim(),
        items,
      }),
    });
    await loadOrder(created.orderId);
  } catch (error) {
    showError(error);
  }
});

document.querySelector('#lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  try {
    await loadOrder(event.currentTarget.orderId.value.trim());
  } catch (error) {
    showError(error);
  }
});

document.querySelector('#status-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();
  const orderId = document.querySelector('#order-id').value.trim();
  try {
    const updated = await api(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: statusSelect.value,
        etag: document.querySelector('#etag').value.trim(),
      }),
    });
    renderOrder(updated);
  } catch (error) {
    showError(error);
  }
});

document.querySelector('#reminder').addEventListener('click', async () => {
  clearError();
  const orderId = document.querySelector('#order-id').value.trim();
  const result = document.querySelector('#reminder-result');
  try {
    const scheduled = await api(`/orders/${encodeURIComponent(orderId)}/reminder`, {
      method: 'POST',
    });
    result.textContent = `Reminder scheduled for ${scheduled.scheduledEnqueueTimeUtc}.`;
  } catch (error) {
    result.textContent = '';
    showError(error);
  }
});

async function refreshHealth() {
  const dot = document.querySelector('#health-dot');
  const text = document.querySelector('#health-text');
  try {
    const health = await api('/health');
    const up = health.status === 'ok';
    dot.className = `dot ${up ? 'ok' : 'bad'}`;
    text.textContent = up ? 'Cosmos is up' : 'Cosmos is down';
  } catch (error) {
    dot.className = 'dot bad';
    text.textContent = 'Health check failed';
    showError(error);
  }
}

async function refreshMetrics() {
  document.querySelector('#metrics').textContent = JSON.stringify(
    await api('/metrics'),
    null,
    2,
  );
}

document.querySelector('#refresh-metrics').addEventListener('click', async () => {
  clearError();
  try {
    await refreshMetrics();
  } catch (error) {
    showError(error);
  }
});

document.querySelector('#refresh-dlq').addEventListener('click', async () => {
  clearError();
  try {
    const peek = await api('/admin/dead-letter-messages');
    document.querySelector('#dlq').textContent = JSON.stringify(peek, null, 2);
  } catch (error) {
    showError(error);
  }
});

refreshHealth();
refreshMetrics().catch(() => {});
setInterval(refreshHealth, 15000);
