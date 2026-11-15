const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.72 Supplier / Factory Stock in Orders Table ---');

// 1. Version assertions
assert.ok(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.72'"), 'CURRENT_APP_VERSION should be sealthai-v3.72');
assert.ok(content.includes("DISPLAY_APP_VERSION = 'v3.72'"), 'DISPLAY_APP_VERSION should be v3.72');
assert.ok(content.includes('v3.72 🚀'), 'Topbar badge should display v3.72 🚀');
console.log('✓ App version is v3.72');

// 2. Desktop orders table includes factory_stock
assert.ok(content.includes("${stockHtml}${factoryStockHtml}"), 'Desktop orders must include factoryStockHtml after stockHtml');
console.log('✓ Desktop orders table includes supplier/factory stock badge');

// 3. Mobile orders card includes factory_stock
assert.ok(content.includes("${partNoTxt}${stockHtml}${factoryStockHtml}${quickAddBtn}"), 'Mobile orders must include factoryStockHtml');
console.log('✓ Mobile orders card includes supplier/factory stock badge');

// 4. Order edit modal includes factory_stock badge
assert.ok(content.includes("สต็อกคงเหลือของ Supplier / โรงงาน"), 'Order edit modal must include supplier/factory stock badge');
console.log('✓ Order edit modal includes supplier/factory stock badge');

// 5. Badge formatting
assert.ok(content.includes("🏭 รง. ${fmt(fStock)}"), 'Must render factory stock with fmt');
console.log('✓ Factory stock renders with 🏭 รง. badge');

// 6. Changelog contains v3.72
assert.ok(content.includes("{ v:'3.72', date:'2026-11-15', badge:'Latest'"), 'Changelog must include v3.72 as Latest');
console.log('✓ Changelog contains v3.72 entry');

console.log('\nAll tests in test_order_supplier_stock_v372.js PASSED successfully!');
