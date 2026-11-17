const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');

function section(startText, endText) {
  const start = html.indexOf(startText);
  const end = html.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `${startText} exists`);
  return html.slice(start, end);
}

const newOrder = section('async function saveOrder() {', '// ── Tracking URL map');
assert.match(newOrder, /if \(orderPayload\.shipping_status === 'shipped' \|\| orderPayload\.shipping_status === 'delivered'\) \{\s*try \{\s*await syncOrderPhysicalStock/);
assert.doesNotMatch(newOrder, /sb\.from\('stock_movements'\)\.insert/,'creating a pending order must not post an outbound movement');

const quoteToOrder = section('async function convertToOrder(qtId)', '// mark quotation as closed');
assert.doesNotMatch(quoteToOrder, /stock_movements/,'quote conversion leaves a pending order as a reservation');

const editOrder = section('async function saveOrderEdit(orderId)', '// ── Record Price Change Audit Log');
assert.match(editOrder, /await syncOrderPhysicalStock\(orderObj, editItems, orderObj\.shipping_status\)/,'editing an order applies the same physical-stock rule');

const guard = section('async function checkOrderStockSufficiency(', 'async function openOrderFulfillmentModal(');
assert.match(guard, /const available = Math\.max\(0, stockVal\);/,'already-shipped quantity is not subtracted twice from physical stock');

const partial = section('async function submitOrderPartialShipment(', 'async function submitSAPCloseOrderApproval(');
assert.match(partial, /await syncOrderPhysicalStock\(\{ \.\.\.ord, shipping_status: newShippingStatus \}, ord\.order_items, newShippingStatus, fulfillmentItems\)/,'partial shipment posts only shipped quantities');
const close = section('async function submitSAPCloseOrderApproval(', '// ─── BAHT TEXT');
assert.match(close, /await syncOrderPhysicalStock\(\{ \.\.\.ord, doc_status: 'closed', shipping_status: 'shipped' \}, ord\.order_items, 'shipped', fulfillmentItems\)/,'SAP close posts the approved shipped quantities');

const migration = fs.readFileSync('supabase_order_physical_stock_v412.sql', 'utf8');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.order_pending_stock_v412_audit/,'legacy movements are archived');
assert.match(migration, /ENABLE ROW LEVEL SECURITY/,'audit rows are not exposed to anonymous clients');
assert.match(migration, /COALESCE\(o\.shipping_status, 'pending'\) = 'pending'/,'migration only restores pending orders');
assert.match(migration, /SET stock_qty = COALESCE\(b\.old_stock_qty, 0\) \+ b\.restore_qty/,'migration restores the exact deducted quantity');

console.log('Pending order stock booking paths: OK');
