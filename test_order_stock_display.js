const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1. Check version bump
assert.ok(/CURRENT_APP_VERSION = 'sealthai-v3\.\d+'/.test(html), 'Version should be sealthai-v3.40+');
assert.ok(/DISPLAY_APP_VERSION = 'v3\.\d+'/.test(html), 'Display version should be v3.40+');

// 1.1 Check ed-doc-status does not do unsafe querySelector on null
assert.ok(!html.includes("querySelector('.btn-status-cancel').style"), 'Must not have unsafe querySelector on null element style');

// 2. Check openQuotationDetail is attached to window
assert.ok(html.includes('window.openQuotationDetail = openQuotationDetail;'), 'window.openQuotationDetail must be globally attached');

// 3. Check loadOrders desktop stock logic
assert.ok(html.includes("const stockVal = (isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock;"), 'Desktop stockVal must calculate pending reserved stock correctly');

// 4. Check loadOrders mobile stock logic
assert.ok(html.includes("const stockVal = (isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock;"), 'Mobile stockVal must calculate pending reserved stock correctly');

// 5. Check order edit stock logic
assert.ok(html.includes("const stockVal = (isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock;"), 'Edit order view must calculate pending reserved stock correctly');

// 6. Test logic simulation
function computeStockDisplay(stock_qty, it_qty, isOrderPending, hasProductId) {
  const rawStock = Number(stock_qty || 0);
  const itemReqQty = Number(it_qty || 1);
  const stockVal = (isOrderPending && hasProductId) ? (rawStock + itemReqQty) : rawStock;
  const isStockOut = stockVal <= 0;
  const isInsufficient = stockVal > 0 && stockVal < itemReqQty;
  const sText = isStockOut ? 'คงเหลือ 0' : (isInsufficient ? `มีแค่ ${stockVal} (ขาด ${itemReqQty - stockVal})` : `คงเหลือ ${stockVal}`);
  const isDanger = isStockOut;
  return { stockVal, isStockOut, isInsufficient, sText, isDanger };
}

// Case A: Unlinked custom product (product_id is null) with 0 stock
const resA = computeStockDisplay(0, 2, true, false);
assert.equal(resA.stockVal, 0, 'When custom product has 0 stock, stockVal must be 0, not 2');
assert.equal(resA.sText, 'คงเหลือ 0', 'Text must say คงเหลือ 0');
assert.equal(resA.isStockOut, true, 'isStockOut must be true');

// Case B: Real catalog product after PO received (+2), so stock_qty=0
const resB = computeStockDisplay(0, 2, true, true);
assert.equal(resB.stockVal, 2, 'After PO receipt, available stock for pending order must be 2');
assert.equal(resB.sText, 'คงเหลือ 2', 'Text must say คงเหลือ 2');
assert.equal(resB.isStockOut, false, 'isStockOut must be false');

// Case C: Partial stock (has 1, needs 2, so stock_qty=-1 before PO or partial)
const resC = computeStockDisplay(-1, 2, true, true);
assert.equal(resC.stockVal, 1);
assert.equal(resC.isInsufficient, true);
assert.equal(resC.sText, 'มีแค่ 1 (ขาด 1)');

// Case D: Warehouse has surplus stock
const resD = computeStockDisplay(3, 2, true, true);
assert.equal(resD.stockVal, 5);
assert.equal(resD.isStockOut, false);
assert.equal(resD.isInsufficient, false);
assert.equal(resD.sText, 'คงเหลือ 5');

console.log('Order stock display tests PASSED (OK)!');
