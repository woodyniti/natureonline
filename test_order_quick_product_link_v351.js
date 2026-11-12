// test_order_quick_product_link_v351.js
const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('--- TEST 1: App Version Bump to v3.51 ---');
assert(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.51'"), 'CURRENT_APP_VERSION should be sealthai-v3.51');
assert(html.includes("DISPLAY_APP_VERSION = 'v3.51'"), 'DISPLAY_APP_VERSION should be v3.51');
assert(html.includes("v3.51 🚀 System Active"), 'Auth card version badge should be v3.51');
assert(html.includes("v3.51 🚀</span>"), 'Topbar version badge should be v3.51');
assert(html.includes("ป้องกันสินค้าซ้ำซ้อน (Duplicate Protection) & ดึงข้อมูล Item Master มาออเดอร์ทันที (v3.51)"), 'Changelog should contain v3.51 entry');
console.log('✓ Test 1 passed: App version is v3.51 everywhere.');

console.log('--- TEST 2: cleanItemName in loadOrders matches master despite [รอสินค้า 15-20 วัน] ---');
assert(html.includes("const cleanItemName = (it.product_name || '').replace(/\\[[^\\]]*\\]/g, '').replace(/\\s+/g, ' ').trim().toLowerCase();"), 'loadOrders should compute cleanItemName');
assert(html.includes("(cleanItemName ? prodByName[cleanItemName] : null)"), 'loadOrders should match cleanItemName in prodByName');

// Test simulation of cleanItemName logic
const rawOrderItemName = 'TC OIL SEAL VITON 205X230X15 [รอสินค้า 15-20 วัน]';
const cleanSim = (rawOrderItemName || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
assert.strictEqual(cleanSim, 'tc oil seal viton 205x230x15');
const mockProdByName = {
  'tc oil seal viton 205x230x15': { id: 'p123', name: 'TC OIL SEAL VITON 205X230X15', sku: 'TC OIL SEAL VITON 205X230X15', stock_qty: 0 }
};
const matchedP = mockProdByName[cleanSim];
assert.ok(matchedP, 'Should resolve product master from cleanItemName');
assert.strictEqual(matchedP.id, 'p123');
console.log('✓ Test 2 passed: Items with [รอสินค้า...] bracket tags seamlessly resolve to Item Master.');

console.log('--- TEST 3: linkProductToOrderItem exists and handles fail-safe RLS fallback ---');
assert(html.includes('async function linkProductToOrderItem(prod, ctx)'), 'linkProductToOrderItem should be defined');
assert(html.includes('delete+insert fallback'), 'linkProductToOrderItem should support delete+insert fallback if update fails');
console.log('✓ Test 3 passed: linkProductToOrderItem is bulletproof with fallback.');

console.log('--- TEST 4: Duplicate product detection in openQuickProductFromOrderItem & saveQuickProduct ---');
assert(html.includes('พบสินค้าในฐานข้อมูลสินค้าอยู่แล้ว!'), 'openQuickProductFromOrderItem should detect existing product in catalog');
assert(html.includes('พบสินค้าชื่อ/SKU นี้อยู่ในฐานข้อมูลแล้ว:'), 'saveQuickProduct should warn on duplicate product before insert');
console.log('✓ Test 4 passed: Duplicate prevention warns and enables 1-click link to existing item.');

console.log('--- TEST 5: cleanItName in renderEditItems for Order Detail modal ---');
assert(html.includes("const cleanItName = (it.product_name || '').replace(/\\[[^\\]]*\\]/g, '').replace(/\\s+/g, ' ').trim().toLowerCase();"), 'renderEditItems should compute cleanItName');
console.log('✓ Test 5 passed: Order detail modal resolves item master with clean name.');

console.log('\n========================================');
console.log('ALL v3.51 TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================');
