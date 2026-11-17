const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('async function syncOrderPhysicalStock(order, items = order.order_items');
const end = html.indexOf('\nlet _orderCustomerList', start);
assert.ok(start >= 0 && end > start, 'stock sync and quick order status handlers exist');
const handler = html.slice(start, end);
assert.equal((html.match(/order_items\(id,product_id,product_name,sku,qty,sell_price,cost_per_unit\)/g) || []).length, 0, 'order_items has no sku column in the live database');

async function transition(from, to, approvedQty = null) {
  const order = {
    id: 'order-1', order_no: 'SO-TEST', order_date: '2026-11-17',
    shipping_status: from, doc_status: approvedQty === null ? 'confirmed' : 'closed',
    order_items: [{ product_id: 'product-1', qty: 10, cost_per_unit: 5 }]
  };
  const movements = [];
  const oldShippedQty = from === 'shipped' ? 10 : from === 'partially_shipped' ? 4 : 0;
  const oldMoves = oldShippedQty ? [{ id: 'movement-1', product_id: 'product-1', move_type: 'out', qty: oldShippedQty, cost_per_unit: 5, note: 'ขาย SO-TEST', move_date: order.order_date }] : [];
  let stockQty = 19 - oldShippedQty;
  const sb = { from(table) {
    if (table === 'orders') return {
      select() { return this; }, eq() { return this; },
      async single() { return { data: order }; },
      update() { return { async eq() { return { error: null }; } }; }
    };
    if (table === 'stock_movements') return {
      select() { return { eq() { return { async in() { return { data: oldMoves, error: null }; } }; } }; },
      delete() { return { async in() { movements.push('delete'); return { error: null }; } }; },
      async insert(rows) { movements.push({ type: 'insert', rows }); return { error: null }; }
    };
    if (table === 'products') return {
      select() { return { async in() { return { data: [{ id: 'product-1', stock_qty: stockQty }], error: null }; } }; },
      update(payload) { return { async eq() { stockQty = payload.stock_qty; return { error: null }; } }; }
    };
    throw new Error(`Unexpected table: ${table}`);
  } };
  const context = {
    sb, currentShop: { id: 'shop-1' }, confirm: () => true, toast: () => {},
    loadOrders: () => {}, loadPendingOrdersCard: () => {},
    triggerAutoContentOnOrderShipped: () => {},
    recalcStockQty: async () => {},
    noteWithCompanyAndShipping: () => '', getOrderShippingFee: () => 0,
    getOrderInternalNote: () => '', getOrderDeliveryDate: () => '', getOrderCustomerEmail: () => '',
    getSAPCloseData: () => approvedQty === null ? null : { shipped_items: [{ product_id: 'product-1', shipped_qty: approvedQty, cost_per_unit: 5 }] },
    localStorage: { removeItem() {} }, today: () => '2026-11-17', console
  };
  vm.createContext(context);
  vm.runInContext(handler, context);
  await context.quickUpdateStatus('order-1', to, null);
  return { movements, stockQty };
}

async function missingOrderLoad() {
  let writes = 0;
  const messages = [];
  const sb = { from(table) {
    assert.equal(table, 'orders');
    return {
      select() { return this; }, eq() { return this; },
      async single() { return { data: null, error: { message: 'order_items.sku column unavailable' } }; },
      update() { writes++; return { eq: async () => ({ error: null }) }; }
    };
  } };
  const context = {
    sb, currentShop: { id: 'shop-1' }, confirm: () => true,
    toast: message => messages.push(message),
    checkOrderStockSufficiency: async () => ({ isSufficient: true }),
    console
  };
  vm.createContext(context);
  vm.runInContext(handler, context);
  const select = {value:'shipped',dataset:{currentStatus:'pending'}};
  await context.quickUpdateStatus('order-1', 'shipped', select);
  assert.equal(writes, 0, 'failed order read must not change shipping status');
  assert.equal(select.value, 'pending', 'failed order read restores the visible status selector');
  assert.ok(messages.some(message => message.includes('order_items.sku column unavailable')), 'user sees the original read failure');
}

(async () => {
  await missingOrderLoad();
  const shipped = await transition('pending', 'shipped');
  assert.equal(shipped.movements.filter(m => m.type === 'insert').length, 1, 'shipping a pending order deducts physical stock once');
  assert.equal(shipped.stockQty, 9, 'shipping 10 from 19 leaves 9 physically in stock');
  const reopened = await transition('shipped', 'pending');
  assert.ok(reopened.movements.includes('delete'), 'reopening a shipped order restores physical stock');
  assert.equal(reopened.stockQty, 19, 'reopening a shipped order restores 10 units');
  const cancelled = await transition('pending', 'cancelled');
  assert.equal(cancelled.stockQty, 19, 'cancelling a pending order does not deduct physical stock');
  const partialReopened = await transition('partially_shipped', 'pending');
  assert.equal(partialReopened.stockQty, 19, 'reopening a partially shipped order returns only the 4 shipped units');
  const partialCompleted = await transition('partially_shipped', 'shipped');
  assert.equal(partialCompleted.stockQty, 9, 'completing a partial shipment deducts only the remaining 6 units');
  const sapClosed = await transition('pending', 'shipped', 4);
  assert.equal(sapClosed.stockQty, 15, 'SAP close deducts only the approved 4 shipped units, not the full order of 10');
  console.log('Order shipping stock transitions: OK');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
