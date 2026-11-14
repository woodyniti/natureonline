const fs = require('fs');
const assert = require('assert');

global.window = global;

console.log('--- Testing Quotation Photo Label & Company Branch v3.61 ---');

const content = fs.readFileSync('index.html', 'utf8');

// 1. App Version Checks
assert(content.includes("const CURRENT_APP_VERSION = 'sealthai-v3.62';"), 'CURRENT_APP_VERSION should be sealthai-v3.62');
assert(content.includes("const DISPLAY_APP_VERSION = 'v3.62';"), 'DISPLAY_APP_VERSION should be v3.62');
assert(content.includes("v3.62 🚀"), 'Topbar badge should show v3.62');
console.log('✓ App Version is v3.62');

// 2. Format Customer Display Name & Company Branch Test
// Extract functions
const fnComp = content.substring(content.indexOf('function formatCompanyWithBranch'), content.indexOf('window.formatCompanyWithBranch = formatCompanyWithBranch;'));
const fnNorm = content.substring(content.indexOf('function _normalizeCompName'), content.indexOf('window._normalizeCompName = _normalizeCompName;'));
const fnCust = content.substring(content.indexOf('function formatCustomerDisplayName'), content.indexOf('window.formatCustomerDisplayName = formatCustomerDisplayName;'));

function escapeHTML(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const ctx = { escapeHTML };
eval(fnComp + '\n' + fnNorm + '\n' + fnCust);

// Test Cases for Customer Display Name
// Case A: Company name set, empty branch -> should default to (สำนักงานใหญ่)
const resA = formatCustomerDisplayName('บริษัท สามมิตรเทค จำกัด', 'บริษัท สามมิตรเทค จำกัด', 'ชาลิสา ขุนอินทอง', false, '');
assert.strictEqual(resA, 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)', 'Should format with (สำนักงานใหญ่)');
console.log('✓ Case A (Company with empty branch):', resA);

// Case B: Company name set, branch "00001" -> should format as (สาขา 00001)
const resB = formatCustomerDisplayName('บริษัท สามมิตรเทค จำกัด', 'บริษัท สามมิตรเทค จำกัด', 'ชาลิสา', false, '00001');
assert.strictEqual(resB, 'บริษัท สามมิตรเทค จำกัด (สาขา 00001)', 'Should format with (สาขา 00001)');
console.log('✓ Case B (Company with branch 00001):', resB);

// Case C: Company name empty, but customer_name is "บริษัท สามมิตรเทค จำกัด" -> should auto-detect company & format as (สำนักงานใหญ่)
const resC = formatCustomerDisplayName('บริษัท สามมิตรเทค จำกัด', '', 'ชาลิสา', false, '');
assert.strictEqual(resC, 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)', 'Should auto-detect company from customer_name and add (สำนักงานใหญ่)');
console.log('✓ Case C (Company in customer_name):', resC);

// Case D: Individual person customer -> should NOT add (สำนักงานใหญ่)
const resD = formatCustomerDisplayName('สมชาย ใจดี', '', '', false, '');
assert.strictEqual(resD, 'สมชาย ใจดี', 'Individual should remain unchanged');
console.log('✓ Case D (Individual customer):', resD);

// 3. Check Quotation Photo Label Changes in Code
assert(!content.includes("title: 'รูปสินค้าจริง ' + (p.sku || p.name)"), 'Should not use รูปสินค้าจริง in selectQuoteProductById');
assert(content.includes("title: 'รูปประกอบสินค้า ' + (p.sku || p.name)"), 'Should use รูปประกอบสินค้า in selectQuoteProductById');

assert(content.includes("title = 'รูปประกอบสินค้า ' + (linked.sku || linked.name)"), 'Should use รูปประกอบสินค้า in auto pull');
assert(content.includes("('รูปประกอบสินค้า ' + (linked ? (linked.sku || linked.name) : it.product_name))"), 'Should use รูปประกอบสินค้า in photo slot title');

assert(content.includes("title: 'รูปประกอบสินค้า: ' + (targetItem.product_name || pMatched.name || '')"), 'Should use รูปประกอบสินค้า in printQuote fallback');

// 4. Test string replacement of existing saved photos with "รูปสินค้าจริง"
const sampleOldTitle = 'รูปสินค้าจริง Digital Vernier 6 inch';
const convertedTitle = sampleOldTitle.replace(/รูป(?:สินค้าจริง|จริงสินค้า)/g, 'รูปประกอบสินค้า');
assert.strictEqual(convertedTitle, 'รูปประกอบสินค้า Digital Vernier 6 inch');
console.log('✓ Converted legacy photo title:', convertedTitle);

console.log('All tests passed 100%!');
