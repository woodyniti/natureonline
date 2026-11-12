const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('Testing v3.45 stock update & PO badge logic...');

// 1. Version check
assert.ok(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.45'"), 'CURRENT_APP_VERSION must be v3.45');
assert.ok(html.includes("DISPLAY_APP_VERSION = 'v3.45'"), 'DISPLAY_APP_VERSION must be v3.45');
assert.ok(html.includes("v3.45 🚀 System Active"), 'System Active badge must be v3.45');
assert.ok(html.includes("v3.45 🚀"), 'Dashboard topbar badge must be v3.45');
console.log('✓ Version assertions passed');

// 2. PO query check
assert.ok(html.includes("qty_ordered,qty_received"), 'PO query must select qty_received');
assert.ok(html.includes("qty_received: Number(poi.qty_received || 0)"), 'PO mapping must pass qty_received');
console.log('✓ PO query & mapping assertions passed');

// 3. Desktop and Mobile stockVal & poTag logic check
assert.ok(html.includes("const stockVal = (isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock;"), 'Desktop stockVal must calculate pending reserved stock correctly');
assert.ok(html.includes("✓ PO รับแล้ว"), 'Must have PO received tag');
console.log('✓ Stock formula & PO badge assertions passed');

// 4. Simulated logic tests
function computeStockDisplay({ p, it, isOrderPending, poMatch }) {
  const isPoReceived = poMatch && (poMatch.status === 'received' || poMatch.status === 'completed' || Number(poMatch.qty_received || 0) >= Number(it.qty || 1));
  const poTag = poMatch 
    ? (isPoReceived ? '✓ PO รับแล้ว' : '🛒 PO')
    : '';

  const rawStock = Number(p.stock_inhouse !== undefined && p.stock_inhouse !== null ? p.stock_inhouse : (p.stock_qty || 0));
  const itemReqQty = Number(it.qty || 1);
  const stockVal = (isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock;
  const isStockOut = stockVal <= 0;
  const isInsufficient = stockVal > 0 && stockVal < itemReqQty;
  const sText = isStockOut ? 'คงเหลือ 0' : (isInsufficient ? `มีแค่ ${stockVal} (ขาด ${itemReqQty - stockVal})` : `คงเหลือ ${stockVal}`);

  return { stockVal, isStockOut, sText, poTag };
}

// Case 1: The exact case of the user!
// 2x K21 38X48X7.5 NBR ordered when stock was 0.
// Then Goods Receipt arrived for +2 pcs, so stock_qty is now 0.
// Order is pending.
const result1 = computeStockDisplay({
  p: { id: '9925d9be', stock_qty: 0 },
  it: { product_id: '9925d9be', qty: 2 },
  isOrderPending: true,
  poMatch: { status: 'received', qty_received: 2 }
});
assert.strictEqual(result1.stockVal, 2, 'Available stock for pending order must be 2 after PO receipt');
assert.strictEqual(result1.isStockOut, false, 'Must not be stock out');
assert.strictEqual(result1.sText, 'คงเหลือ 2', 'Must display คงเหลือ 2');
assert.strictEqual(result1.poTag, '✓ PO รับแล้ว', 'Must display ✓ PO รับแล้ว');
console.log('✓ Case 1 (User scenario after GR received) passed: stockVal=2, text="คงเหลือ 2", badge="✓ PO รับแล้ว"');

// Case 2: Before PO arrives (stock_qty is -2)
const result2 = computeStockDisplay({
  p: { id: '9925d9be', stock_qty: -2 },
  it: { product_id: '9925d9be', qty: 2 },
  isOrderPending: true,
  poMatch: { status: 'ordered', qty_received: 0 }
});
assert.strictEqual(result2.stockVal, 0, 'Available stock before PO arrives must be 0');
assert.strictEqual(result2.isStockOut, true, 'Must be stock out');
assert.strictEqual(result2.sText, 'คงเหลือ 0', 'Must display คงเหลือ 0');
assert.strictEqual(result2.poTag, '🛒 PO', 'Must display 🛒 PO');
console.log('✓ Case 2 (Before PO received) passed: stockVal=0, text="คงเหลือ 0", badge="🛒 PO"');

// Case 3: Custom item with product_id=null (Issue 4 regression guard)
const result3 = computeStockDisplay({
  p: { id: 'custom-p', stock_qty: 0 },
  it: { product_id: null, qty: 2 },
  isOrderPending: true,
  poMatch: null
});
assert.strictEqual(result3.stockVal, 0, 'Custom unlinked item with 0 stock must remain 0');
assert.strictEqual(result3.isStockOut, true, 'Must be stock out');
assert.strictEqual(result3.sText, 'คงเหลือ 0', 'Must display คงเหลือ 0');
console.log('✓ Case 3 (Issue 4 regression prevention) passed: stockVal=0, text="คงเหลือ 0"');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');
