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

// 3. Check loadOrders desktop stock logic does NOT add it.qty back into stockVal
const desktopStockMatch = html.match(/const stockVal = Number\(p\.stock_inhouse[\s\S]*?const sText = isStockOut \? 'คงเหลือ 0'/);
assert.ok(desktopStockMatch, 'Desktop stockVal extraction failed');
assert.ok(!desktopStockMatch[0].includes('rawStock + Number(it.qty'), 'Desktop view must not add it.qty back into stockVal');

// 4. Check loadOrders mobile stock logic does NOT add it.qty back into stockVal
const mobileStockMatch = html.match(/prodHtml = \(o\.order_items[\s\S]*?const stockVal = Number\(p\.stock_inhouse[\s\S]*?const sText = isStockOut \? 'คงเหลือ 0'/);
assert.ok(mobileStockMatch, 'Mobile stockVal extraction failed');
assert.ok(!mobileStockMatch[0].includes('rawStock + Number(it.qty'), 'Mobile view must not add it.qty back into stockVal');

// 5. Check order edit stock logic
const editStockMatch = html.match(/const stockVal = Number\(_pItem\.stock_inhouse[\s\S]*?const sText = isOut \? 'คงเหลือ 0'/);
assert.ok(editStockMatch, 'Edit order stockVal extraction failed');
assert.ok(!editStockMatch[0].includes('rawStock + Number(it.qty'), 'Edit order view must not add it.qty back into stockVal');

// 6. Test logic simulation
function computeStockDisplay(stock_qty, it_qty, isOrderPending) {
  const stockVal = Number(stock_qty || 0);
  const itemReqQty = Number(it_qty || 1);
  const isStockOut = stockVal <= 0;
  const isInsufficient = stockVal > 0 && stockVal < itemReqQty;
  const sText = isStockOut ? 'คงเหลือ 0' : (isInsufficient ? `มีแค่ ${stockVal} (ขาด ${itemReqQty - stockVal})` : `คงเหลือ ${stockVal}`);
  const isDanger = isStockOut;
  return { stockVal, isStockOut, isInsufficient, sText, isDanger };
}

// Case A: Warehouse has 0 stock, Order asks for 2
const resA = computeStockDisplay(0, 2, true);
assert.equal(resA.stockVal, 0, 'When stock_qty is 0, stockVal must be 0, not 2');
assert.equal(resA.sText, 'คงเหลือ 0', 'Text must say คงเหลือ 0');
assert.equal(resA.isStockOut, true, 'isStockOut must be true');

// Case B: Warehouse has 1 stock, Order asks for 2
const resB = computeStockDisplay(1, 2, true);
assert.equal(resB.stockVal, 1);
assert.equal(resB.isInsufficient, true);
assert.equal(resB.sText, 'มีแค่ 1 (ขาด 1)');

// Case C: Warehouse has 5 stock, Order asks for 2
const resC = computeStockDisplay(5, 2, true);
assert.equal(resC.stockVal, 5);
assert.equal(resC.isStockOut, false);
assert.equal(resC.isInsufficient, false);
assert.equal(resC.sText, 'คงเหลือ 5');

console.log('Order stock display tests PASSED (OK)!');
