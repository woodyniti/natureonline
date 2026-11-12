const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

console.log('--- TEST 1: App Version Bump to v3.52 ---');
assert.match(html, /const CURRENT_APP_VERSION = 'sealthai-v3\.52';/, 'CURRENT_APP_VERSION must be sealthai-v3.52');
assert.match(html, /const DISPLAY_APP_VERSION = 'v3\.52';/, 'DISPLAY_APP_VERSION must be v3.52');
assert.match(html, /v3\.52 🚀 System Active/, 'Auth badge must be v3.52');
assert.match(html, /v3\.52 🚀/, 'Topbar badge must be v3.52');
assert.match(html, /v:'3\.52'/, 'Changelog must contain v3.52');
console.log('✓ Test 1 passed: App version is v3.52 everywhere.');

console.log('--- TEST 2: openReceiptOptions & openOrderPrintOptions Modal Choices ---');
assert.match(html, /function openReceiptOptions\(orderId, defaultDocType='receipt'\)/, 'openReceiptOptions accepts orderId and defaultDocType');
assert.match(html, /name="order-print-doctype" value="receipt"/, 'modal contains receipt radio');
assert.match(html, /name="order-print-doctype" value="invoice"/, 'modal contains invoice radio');
assert.match(html, /name="order-print-doctype" value="delivery"/, 'modal contains delivery note radio');
assert.match(html, /id="receipt-show-delivery-price"/, 'modal contains delivery price toggle');
assert.match(html, /window\.openOrderPrintOptions = openReceiptOptions;/, 'openOrderPrintOptions alias exists');
console.log('✓ Test 2 passed: Modal provides comprehensive document options.');

console.log('--- TEST 3: printReceipt Multi-document Engine ---');
assert.match(html, /async function printReceipt\(orderId, showDiscount=true, showSignature=false, docCopyType='original', docType='receipt', showPriceInDelivery=true\)/, 'printReceipt has full multi-document signature');
assert.match(html, /bill-type invoice/, 'invoice badge class exists');
assert.match(html, /bill-type delivery/, 'delivery badge class exists');
assert.match(html, /ใบแจ้งหนี้ \/ ใบเรียกเก็บเงิน/, 'Invoice title present');
assert.match(html, /INVOICE \/ BILLING NOTE/, 'Invoice EN subtitle present');
assert.match(html, /ใบส่งสินค้า \/ ใบส่งของ/, 'Delivery Note title present');
assert.match(html, /DELIVERY NOTE \/ PACKING SLIP/, 'Delivery Note EN subtitle present');
assert.match(html, /PACKING LIST/, 'Packing list badge present');
console.log('✓ Test 3 passed: Document headers and badge styles are implemented.');

console.log('--- TEST 4: Invoice Payment Terms & Dual Signatures ---');
assert.match(html, /กำหนดชำระ \/ Due Date:/, 'Invoice shows payment due date');
assert.match(html, /💳 ชำระเงินโดยการโอนเงินเข้าบัญชี \(Bank Transfer\):/, 'Invoice shows bank transfer box');
assert.match(html, /ผู้รับใบแจ้งหนี้ \/ Received By/, 'Invoice shows recipient signature');
assert.match(html, /ผู้วางบิล \/ Authorized Signature/, 'Invoice shows authorized issuer signature');
console.log('✓ Test 4 passed: Invoice includes payment terms, bank account, and dual signatures.');

console.log('--- TEST 5: Delivery Note Shipping Details & Dual Signatures ---');
assert.match(html, /ข้อมูลผู้รับสินค้า \/ สถานที่จัดส่ง \(Ship To \/ Consignee\):/, 'Delivery note highlights shipping address');
assert.match(html, /วันส่งสินค้า \/ Delivery:/, 'Delivery note highlights delivery date');
assert.match(html, /ผู้ส่งสินค้า \/ Delivered By/, 'Delivery note shows sender signature');
assert.match(html, /ผู้รับสินค้า \/ Received By/, 'Delivery note shows receiver acceptance signature');
assert.match(html, /ได้รับสินค้าข้างต้นในสภาพเรียบร้อย ถูกต้อง ครบถ้วน/, 'Delivery note includes confirmation text');
console.log('✓ Test 5 passed: Delivery note includes shipping information and receipt confirmation.');

console.log('--- TEST 6: UI Entry Points in Desktop Table, Mobile Cards & Order Detail Modal ---');
assert.match(html, /title="พิมพ์บิลเงินสด \/ ใบแจ้งหนี้ \(Invoice\) \/ ใบส่งสินค้า \(Delivery Note\)">🖨️ พิมพ์เอกสาร \(บิล\/แจ้งหนี้\/ส่งของ\)/, 'Order detail action bar has multi-document print button');
assert.match(html, /<button class="btn btn-secondary btn-sm" onclick="openReceiptOptions\('\$\{o\.id\}'\)" title="พิมพ์เอกสาร \(บิลเงินสด \/ ใบแจ้งหนี้ \/ ใบส่งสินค้า\)" style="background:#e8f5f0;color:#00a882;border-color:#00a882;padding:4px 9px">🖨️<\/button>/, 'Orders desktop table has quick print button');
assert.match(html, /onclick="event\.stopPropagation\(\);openReceiptOptions\('\$\{o\.id\}'\)" style="background:#e8f5f0;color:#00a882;border-color:#00a882;font-size:11px;padding:4px 6px" title="พิมพ์บิล \/ ใบแจ้งหนี้ \/ ใบส่งสินค้า">🖨️ พิมพ์เอกสาร<\/button>/, 'Mobile cards have print document button');
console.log('✓ Test 6 passed: Quick print entry points are active across all views.');

console.log('\n========================================');
console.log('ALL v3.52 ORDER DOCUMENT PRINTING TESTS PASSED 100%! 🚀');
console.log('========================================');
