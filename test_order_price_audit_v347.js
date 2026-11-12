const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('Testing v3.47 Order Price Change Audit Logs & Read-Only Viewer...');

// 1. Version assertions
assert.ok(/CURRENT_APP_VERSION = 'sealthai-v3\.(?:4[7-9]|[5-9][0-9])'/.test(html), 'CURRENT_APP_VERSION must be >= v3.47');
assert.ok(/DISPLAY_APP_VERSION = 'v3\.(?:4[7-9]|[5-9][0-9])'/.test(html), 'DISPLAY_APP_VERSION must be >= v3.47');
assert.ok(/v3\.(?:4[7-9]|[5-9][0-9]) 🚀 System Active/.test(html), 'Auth logo version badge must be >= v3.47');
assert.ok(/v3\.(?:4[7-9]|[5-9][0-9]) 🚀/.test(html), 'Topbar badge must be >= v3.47');
assert.ok(html.includes("v:'3.47'"), 'Changelog must include v3.47 entry');
console.log('✓ 1. Version assertions passed');

// 2. Function declarations
assert.ok(html.includes('function detectOrderPriceDiffs'), 'Must declare detectOrderPriceDiffs');
assert.ok(html.includes('function recordOrderPriceChangeLog'), 'Must declare recordOrderPriceChangeLog');
assert.ok(html.includes('function getOrderPriceLogs'), 'Must declare getOrderPriceLogs');
assert.ok(html.includes('function getOrderPriceChangeCount'), 'Must declare getOrderPriceChangeCount');
assert.ok(html.includes('function openOrderPriceHistoryModal'), 'Must declare openOrderPriceHistoryModal');
console.log('✓ 2. Core function declarations verified');

// 3. UI Entry points
assert.ok(html.includes('📜 ประวัติแก้ไขราคา'), 'Order detail footer must have Price History button');
assert.ok(html.includes('openOrderPriceHistoryModal'), 'Order list & detail must link to openOrderPriceHistoryModal');
assert.ok(html.includes('📝 แก้ไขราคา ('), 'Desktop and mobile views must show price change badge');
console.log('✓ 3. UI Entry points verified');

// 4. Test detectOrderPriceDiffs logic
function fmt(n) { return Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}); }

// Extract detectOrderPriceDiffs from html or test logic
const mFn = html.match(/function detectOrderPriceDiffs\(\{[\s\S]*?return diffs;\s*\}/);
assert.ok(mFn, 'detectOrderPriceDiffs must be found in code');
const detectOrderPriceDiffs = new Function('fmt', `return ${mFn[0]}`)(fmt);

// Test Case A: Grand total and shipping fee change
const diffsA = detectOrderPriceDiffs({
  oldOrder: { total_amount: 240, shipping_fee: 0 },
  oldItems: [{ id: '1', product_name: 'TC OIL SEAL', sell_price: 80, qty: 3 }],
  oldSubtotal: 240,
  oldBillDisc: 0,
  oldBillDiscType: 'amount',
  oldShippingFee: 0,
  oldGrand: 240,
  newItems: [{ id: '1', product_name: 'TC OIL SEAL', sell_price: 80, qty: 3 }],
  newSubtotal: 240,
  newBillDisc: 0,
  newBillDiscType: 'amount',
  newShippingFee: 50,
  newGrand: 290
});

assert.strictEqual(diffsA.length, 2, 'Should detect grand total and shipping fee diffs');
assert.strictEqual(diffsA.find(d => d.type === 'grand_total').diff, 50);
assert.strictEqual(diffsA.find(d => d.type === 'shipping_fee').diff, 50);
console.log('✓ 4. detectOrderPriceDiffs (Case A: Shipping & Grand Total) passed');

// Test Case B: Item price, qty, and discount change
const diffsB = detectOrderPriceDiffs({
  oldOrder: { total_amount: 200 },
  oldItems: [{ id: '10', product_name: 'O-RING VITON', sell_price: 100, qty: 2, discount: 0, discount_type: 'amount' }],
  oldSubtotal: 200,
  oldBillDisc: 0,
  oldBillDiscType: 'amount',
  oldShippingFee: 0,
  oldGrand: 200,
  newItems: [{ id: '10', product_name: 'O-RING VITON', sell_price: 120, qty: 3, discount: 20, discount_type: 'amount' }],
  newSubtotal: 340,
  newBillDisc: 0,
  newBillDiscType: 'amount',
  newShippingFee: 0,
  newGrand: 340
});

assert.ok(diffsB.some(d => d.type === 'item_price' && d.oldVal === 100 && d.newVal === 120), 'Should detect item price change');
assert.ok(diffsB.some(d => d.type === 'item_qty' && d.oldVal === 2 && d.newVal === 3), 'Should detect item qty change');
assert.ok(diffsB.some(d => d.type === 'item_discount'), 'Should detect item discount change');
assert.ok(diffsB.some(d => d.type === 'grand_total' && d.diff === 140), 'Should detect grand total change');
console.log('✓ 5. detectOrderPriceDiffs (Case B: Item Price, Qty & Discount) passed');

// Test Case C: Item Added and Item Removed
const diffsC = detectOrderPriceDiffs({
  oldOrder: { total_amount: 100 },
  oldItems: [{ id: '100', product_name: 'ITEM TO REMOVE', sell_price: 100, qty: 1 }],
  oldSubtotal: 100,
  oldBillDisc: 0,
  oldBillDiscType: 'amount',
  oldShippingFee: 0,
  oldGrand: 100,
  newItems: [{ id: '200', product_name: 'ITEM NEWLY ADDED', sell_price: 150, qty: 1 }],
  newSubtotal: 150,
  newBillDisc: 0,
  newBillDiscType: 'amount',
  newShippingFee: 0,
  newGrand: 150
});

assert.ok(diffsC.some(d => d.type === 'item_removed'), 'Should detect item_removed');
assert.ok(diffsC.some(d => d.type === 'item_added'), 'Should detect item_added');
console.log('✓ 6. detectOrderPriceDiffs (Case C: Item Added & Removed) passed');

// Test Case D: No price change (only non-price fields modified)
const diffsD = detectOrderPriceDiffs({
  oldOrder: { total_amount: 240, shipping_fee: 0 },
  oldItems: [{ id: '1', product_name: 'TC OIL SEAL', sell_price: 80, qty: 3 }],
  oldSubtotal: 240,
  oldBillDisc: 0,
  oldBillDiscType: 'amount',
  oldShippingFee: 0,
  oldGrand: 240,
  newItems: [{ id: '1', product_name: 'TC OIL SEAL', sell_price: 80, qty: 3 }],
  newSubtotal: 240,
  newBillDisc: 0,
  newBillDiscType: 'amount',
  newShippingFee: 0,
  newGrand: 240
});

assert.strictEqual(diffsD.length, 0, 'No diffs should be detected when prices are unchanged');
console.log('✓ 7. detectOrderPriceDiffs (Case D: Zero Diffs when unchanged) passed');

console.log('\nALL ORDER PRICE CHANGE AUDIT LOG TESTS PASSED SUCCESSFULLY! 🚀');
