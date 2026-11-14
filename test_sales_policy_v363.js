const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.63 Return & Warranty Policy across Sales Documents ---');

// 1. Version assertions
assert.ok(/CURRENT_APP_VERSION = 'sealthai-v3\.(6[3-9]|[7-9][0-9])'/.test(content), 'CURRENT_APP_VERSION should be >= sealthai-v3.63');
assert.ok(/DISPLAY_APP_VERSION = 'v3\.(6[3-9]|[7-9][0-9])'/.test(content), 'DISPLAY_APP_VERSION should be >= v3.63');
assert.ok(/v3\.(6[3-9]|[7-9][0-9]) 🚀/.test(content), 'Topbar badge should display >= v3.63 🚀');
console.log('✓ App version verified');

// 2. printReceipt contains policy-box
assert.ok(content.includes("billParts.push('<div class=\"policy-box\">');"), 'printReceipt must include policy-box');
assert.ok(content.includes("billParts.push('<div class=\"policy-title\">🛡️ เงื่อนไขการรับประกันและการเปลี่ยน/คืนสินค้า (Return & Warranty Policy):</div>');"), 'printReceipt must include policy-title');
assert.ok(content.includes("billParts.push('<li><strong>กำหนดเวลาตรวจสอบ:</strong> กรุณาตรวจสอบสินค้าทันทีที่ได้รับ หากพบปัญหาแจ้งเปลี่ยน/คืนได้ภายใน <strong>7 วัน</strong> (เกิน 7 วัน ขอสงวนสิทธิ์ไม่รับเปลี่ยนหรือคืนทุกกรณี)</li>');"), 'printReceipt must contain 7-day policy rule');
assert.ok(content.includes("billParts.push('<li><strong>สภาพสินค้า:</strong> สินค้าที่ขอเปลี่ยนหรือคืน ต้องอยู่ในสภาพสมบูรณ์ 100% <strong>ไม่ผ่านการทดลองใส่ ไม่ผ่านการใช้งาน</strong> หรือดัดแปลงใดๆ พร้อมบรรจุภัณฑ์เดิมครบถ้วน</li>');"), 'printReceipt must contain 100% condition rule');
assert.ok(content.includes("billParts.push('<li><strong>สินค้าสั่งผลิตพิเศษ / งานกลึง:</strong> สินค้าที่เป็น<strong>งานกลึง งานขึ้นรูป หรือสั่งผลิตใหม่ตามแบบ/ขนาดเฉพาะ</strong> ขอสงวนสิทธิ์ไม่รับเปลี่ยน คืน หรือยกเลิกคำสั่งซื้อทุกกรณี (เว้นแต่กรณีผลิตผิดสเปกจากแบบที่ตกลงกัน)</li>');"), 'printReceipt must contain custom/machined parts rule');
console.log('✓ printReceipt (Delivery Note, Invoice, Receipt) includes Return & Warranty Policy');

// 3. printQuote contains policy-box
assert.ok(content.includes("bp.push('<div class=\"policy-box\">');"), 'printQuote must include policy-box');
assert.ok(content.includes("bp.push('<div class=\"policy-title\">🛡️ เงื่อนไขการรับประกันและการเปลี่ยน/คืนสินค้า (Return & Warranty Policy):</div>');"), 'printQuote must include policy-title');
console.log('✓ printQuote (Quotation) includes Return & Warranty Policy');

// 4. viewOrder Notes tab contains policy box
assert.ok(content.includes("🛡️ เงื่อนไขการรับประกันและการเปลี่ยน/คืนสินค้า (Return & Warranty Policy):"), 'viewOrder and viewQuote must display policy');
const viewOrderPolicyMatches = content.match(/🛡️ เงื่อนไขการรับประกันและการเปลี่ยน\/คืนสินค้า \(Return & Warranty Policy\):/g);
assert.ok(viewOrderPolicyMatches && viewOrderPolicyMatches.length >= 4, `Expected at least 4 occurrences of policy title across UI & print documents, found ${viewOrderPolicyMatches ? viewOrderPolicyMatches.length : 0}`);
console.log(`✓ Found ${viewOrderPolicyMatches.length} occurrences across UI modals and print documents`);

// 5. Check MIN_ROWS in printReceipt is 6 for 1-page A4 print
const minRowsMatch = content.match(/const\s+MIN_ROWS\s*=\s*(\d+);/);
assert.ok(minRowsMatch, 'MIN_ROWS must be defined in printReceipt');
assert.strictEqual(minRowsMatch[1], '6', 'MIN_ROWS in printReceipt should be 6 to fit policy box on 1-page A4');
console.log('✓ MIN_ROWS is 6 in printReceipt (guarantees 1-page A4 layout)');

// 6. Changelog contains v3.63
assert.ok(content.includes("{ v:'3.63', date:'2026-11-14'"), 'Changelog must include v3.63');
console.log('✓ Changelog contains v3.63 entry');

console.log('\nAll tests in test_sales_policy_v363.js PASSED successfully!');
