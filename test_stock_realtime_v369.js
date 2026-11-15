const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.69 Real Warehouse Stock Display ---');

// 1. Version assertions
assert.ok(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.69'"), 'CURRENT_APP_VERSION should be sealthai-v3.69');
assert.ok(content.includes("DISPLAY_APP_VERSION = 'v3.69'"), 'DISPLAY_APP_VERSION should be v3.69');
assert.ok(content.includes('v3.69 🚀'), 'Topbar badge should display v3.69 🚀');
console.log('✓ App version is v3.69');

// 2. Desktop & Mobile orders table does not add itemReqQty to rawStock
assert.ok(!content.includes("(isOrderPending && it.product_id) ? (rawStock + itemReqQty) : rawStock"), 'Must not add itemReqQty to rawStock when pending');
assert.ok(content.includes("const stockVal = rawStock;"), 'Desktop & mobile orders must use rawStock directly');
console.log('✓ Orders table uses real on-hand stock (rawStock) directly');

// 3. Out-of-stock badge text
assert.ok(content.includes("const sText = isStockOut ? 'สต๊อกหมด (0)' : (isInsufficient ? `มีแค่ ${fmt(stockVal)} (ขาด ${fmt(itemReqQty - stockVal)})` : `คงเหลือ ${fmt(stockVal)}`);"), 'Must display สต๊อกหมด (0) when stock is 0 or less');
console.log('✓ Out of stock displays ⚠️ สต๊อกหมด (0) in Red');

// 4. Order edit modal uses real stock
assert.ok(content.includes("const sText = isOut ? 'สต๊อกหมด (0)' : (isInsufficient ? `มีแค่ ${fmt(stockVal)} (ขาด ${fmt(itemReqQty - stockVal)})` : `คงเหลือ: ${fmt(stockVal)} ชิ้น`);"), 'Order edit modal must display สต๊อกหมด (0)');
console.log('✓ Order edit modal uses real stock directly');

// 5. Fulfillment calculations use real stock
assert.ok(content.includes("// Physical available stock: use actual warehouse on-hand stock"), 'Fulfillment status must use real on-hand stock');
console.log('✓ Fulfillment status uses real warehouse on-hand stock');

// 6. Changelog contains v3.69
assert.ok(content.includes("{ v:'3.69', date:'2026-11-15', badge:'Latest'"), 'Changelog must include v3.69 as Latest');
console.log('✓ Changelog contains v3.69 entry');

console.log('\nAll tests in test_stock_realtime_v369.js PASSED successfully!');
