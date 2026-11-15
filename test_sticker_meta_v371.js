const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.71 Product Sticker Customer Name & Shopee Ref ---');

// 1. Version assertions
assert.ok(/CURRENT_APP_VERSION = 'sealthai-v3\.(7[1-9]|[8-9]\d)'/.test(content), 'CURRENT_APP_VERSION should be >= sealthai-v3.71');
assert.ok(/DISPLAY_APP_VERSION = 'v3\.(7[1-9]|[8-9]\d)'/.test(content), 'DISPLAY_APP_VERSION should be >= v3.71');
assert.ok(/v3\.(7[1-9]|[8-9]\d) 🚀/.test(content), 'Topbar badge should display >= v3.71 🚀');
console.log('✓ App version is >= v3.71');

// 2. Customer name and Shopee ref under SO
assert.ok(content.includes('const custName = String(order.customer_name || \'\').trim();'), 'Must extract customer_name');
assert.ok(content.includes('const shopeeRef = String(order.customer_social || order.platform_order_id || \'\').trim();'), 'Must extract shopeeRef from customer_social or platform_order_id');
assert.ok(content.includes('stk-meta-left'), 'Must have stk-meta-left container');
assert.ok(content.includes('stk-sub-text'), 'Must have stk-sub-text element for customer & shopee ref');
console.log('✓ Sticker header includes customer name and Shopee reference under SO');

// 3. CSS for sub-text
assert.ok(content.includes('.stk-sub-text { font-size:9px;'), 'Must have CSS for stk-sub-text');
console.log('✓ CSS for stk-sub-text defined');

// 4. Changelog contains v3.71
assert.ok(content.includes("{ v:'3.71', date:'2026-11-15'"), 'Changelog must include v3.71');
console.log('✓ Changelog contains v3.71 entry');

console.log('\nAll tests in test_sticker_meta_v371.js PASSED successfully!');
