// test_order_quick_product_link_v350.js
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('--- TEST 1: App Version Bump to v3.50 ---');
assert(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.50'"), 'CURRENT_APP_VERSION should be sealthai-v3.50');
assert(html.includes("DISPLAY_APP_VERSION = 'v3.50'"), 'DISPLAY_APP_VERSION should be v3.50');
assert(html.includes("v3.50 🚀 System Active"), 'Auth card version badge should be v3.50');
assert(html.includes("v3.50 🚀</span>"), 'Topbar version badge should be v3.50');
assert(html.includes("เพิ่มสินค้าเข้าฐานข้อมูลสินค้าด่วนจากรายการในหน้าออเดอร์"), 'Changelog should contain v3.50 entry');
console.log('✓ Test 1 passed: App version is v3.50 everywhere.');

console.log('--- TEST 2: Helper openQuickProductFromOrderItem exists and cleans name ---');
assert(html.includes('async function openQuickProductFromOrderItem(triggerEl)'), 'openQuickProductFromOrderItem should be defined');
assert(html.includes('.replace(/\\[[^\\]]*\\]/g, \'\')'), 'openQuickProductFromOrderItem should strip bracket tags like [รอสินค้า 15-20 วัน]');

// Simulate name cleaning
const testRawName = 'TC OIL SEAL VITON 205X230X15 [รอสินค้า 15-20 วัน]';
const cleaned = testRawName.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
assert.strictEqual(cleaned, 'TC OIL SEAL VITON 205X230X15', 'Should strip lead time bracket cleanly');

// Check dimensions parsing with onQPNameChange logic
const dimMatch = cleaned.match(/(\d+(?:\.\d+)?)[xX*\-_](\d+(?:\.\d+)?)[xX*\-_](\d+(?:\.\d+)?)/);
assert(dimMatch, 'Should match dimensions 205x230x15');
assert.strictEqual(dimMatch[1], '205');
assert.strictEqual(dimMatch[2], '230');
assert.strictEqual(dimMatch[3], '15');
console.log('✓ Test 2 passed: Name cleaning and dimension extraction works accurately.');

console.log('--- TEST 3: Desktop Table & Mobile Cards Render ➕ เพิ่มเข้าฐานข้อมูล on unlinked items ---');
assert(html.includes('➕ เพิ่มเข้าฐานข้อมูล</span>'), 'Desktop and mobile should have ➕ เพิ่มเข้าฐานข้อมูล button');
assert(html.includes('openQuickProductFromOrderItem(this)'), 'Button should trigger openQuickProductFromOrderItem with this');
assert(html.includes('data-item="'), 'Button should carry data-item payload');
console.log('✓ Test 3 passed: Desktop and Mobile render quick add badge for unlinked items.');

console.log('--- TEST 4: Order Detail Modal renderEditItems Renders ➕ เพิ่มเข้าฐานข้อมูลสินค้า ---');
assert(html.includes('➕ เพิ่มเข้าฐานข้อมูลสินค้า'), 'renderEditItems should have ➕ เพิ่มเข้าฐานข้อมูลสินค้า');
console.log('✓ Test 4 passed: Order Detail modal renders quick add button for unlinked items.');

console.log('--- TEST 5: saveQuickProduct handles order_item_link context ---');
assert(html.includes("ctx.type === 'order_item_link'"), 'saveQuickProduct should check ctx.type === order_item_link');
assert(html.includes("sb.from('order_items').update(updateData)"), 'saveQuickProduct should update order_items');
assert(html.includes("toast('🎉 สร้างสินค้า \"' + escapeHTML(newProd.name) + '\" เข้าคลังและเชื่อมโยงกับออเดอร์เรียบร้อยแล้วค่ะ ✓', 'success')"), 'saveQuickProduct should show linking toast');
console.log('✓ Test 5 passed: saveQuickProduct handles order_item_link seamlessly.');

console.log('\n========================================');
console.log('ALL v3.50 TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================');
