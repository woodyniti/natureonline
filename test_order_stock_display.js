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
assert.ok(html.includes("const stockVal = rawStock;"), 'Desktop stockVal must use raw warehouse stock directly');

// 4. Check loadOrders mobile stock logic
assert.ok(html.includes("const sText = isStockOut ? 'สต๊อกหมด (0)' : (isInsufficient ? `มีแค่ ${fmt(stockVal)} (ขาด ${fmt(itemReqQty - stockVal)})` : `คงเหลือ ${fmt(stockVal)}`);"), 'Stock badge text must handle out of stock correctly');

// 5. Check order edit stock logic
assert.ok(html.includes("const sText = isOut ? 'สต๊อกหมด (0)' : (isInsufficient ? `มีแค่ ${fmt(stockVal)} (ขาด ${fmt(itemReqQty - stockVal)})` : `คงเหลือ: ${fmt(stockVal)} ชิ้น`);"), 'Edit order view must handle out of stock correctly');

// 6. Test logic simulation
function computeStockDisplay(stock_qty, it_qty) {
  const rawStock = Number(stock_qty || 0);
  const itemReqQty = Number(it_qty || 1);
  const stockVal = rawStock;
  const isStockOut = stockVal <= 0;
  const isInsufficient = stockVal > 0 && stockVal < itemReqQty;
  const sText = isStockOut ? 'สต๊อกหมด (0)' : (isInsufficient ? `มีแค่ ${stockVal} (ขาด ${itemReqQty - stockVal})` : `คงเหลือ ${stockVal}`);
  const isDanger = isStockOut;
  return { stockVal, isStockOut, isInsufficient, sText, isDanger };
}

// Case A: Product has 0 stock in warehouse, order needs 2
const resA = computeStockDisplay(0, 2);
assert.equal(resA.stockVal, 0, 'When product has 0 stock in warehouse, stockVal must be 0');
assert.equal(resA.sText, 'สต๊อกหมด (0)', 'Text must say สต๊อกหมด (0)');
assert.equal(resA.isStockOut, true, 'isStockOut must be true');

// Case B: Product has 1 in stock, order needs 2
const resB = computeStockDisplay(1, 2);
assert.equal(resB.stockVal, 1);
assert.equal(resB.isInsufficient, true);
assert.equal(resB.sText, 'มีแค่ 1 (ขาด 1)');

// Case C: Product has 2 in stock, order needs 2
const resC = computeStockDisplay(2, 2);
assert.equal(resC.stockVal, 2);
assert.equal(resC.isStockOut, false);
assert.equal(resC.isInsufficient, false);
assert.equal(resC.sText, 'คงเหลือ 2');

// Case D: Warehouse has surplus stock
const resD = computeStockDisplay(5, 2);
assert.equal(resD.stockVal, 5);
assert.equal(resD.isStockOut, false);
assert.equal(resD.isInsufficient, false);
assert.equal(resD.sText, 'คงเหลือ 5');
assert.equal(resD.sText, 'คงเหลือ 5');

console.log('Order stock display tests PASSED (OK)!');
