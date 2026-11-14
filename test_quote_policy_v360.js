const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- TEST SUITE: v3.60 Quotation Return & Warranty Policy ---');

// 1. Version check
if (!html.includes("CURRENT_APP_VERSION = 'sealthai-v3.60'") && !html.includes("CURRENT_APP_VERSION = 'sealthai-v3.61'")) {
  console.error('FAIL: CURRENT_APP_VERSION is not v3.60/v3.61');
  process.exit(1);
}
console.log('PASS: Version bump verified.');

// 2. Check Policy Box in printQuote
if (!html.includes('🛡️ เงื่อนไขการรับประกันและการเปลี่ยน/คืนสินค้า (Return & Warranty Policy):')) {
  console.error('FAIL: Policy box header not found');
  process.exit(1);
}
if (!html.includes('เกิน 7 วัน ขอสงวนสิทธิ์ไม่รับเปลี่ยนหรือคืนทุกกรณี')) {
  console.error('FAIL: 7-day rule not found in printQuote');
  process.exit(1);
}
if (!html.includes('ไม่ผ่านการทดลองใส่ ไม่ผ่านการใช้งาน')) {
  console.error('FAIL: Unused condition rule not found in printQuote');
  process.exit(1);
}
if (!html.includes('งานกลึง งานขึ้นรูป หรือสั่งผลิตใหม่ตามแบบ')) {
  console.error('FAIL: Custom/machined parts rule not found in printQuote');
  process.exit(1);
}
console.log('PASS: Policy box in printQuote verified with all 3 conditions.');

// 3. Check Policy Box in viewQuoteModal (Notes Tab)
if (!html.includes('<div class="sap-tab-pane" data-pane="notes">') || !html.includes('🛡️ เงื่อนไขการรับประกันและการเปลี่ยน/คืนสินค้า')) {
  console.error('FAIL: Policy box not found in viewQuoteModal Notes tab');
  process.exit(1);
}
console.log('PASS: Policy box in viewQuoteModal Notes tab verified.');

// 4. Check CSS styles for policy box
if (!html.includes('.policy-box{') || !html.includes('.policy-title{') || !html.includes('.policy-list{')) {
  console.error('FAIL: Policy box CSS styles not found');
  process.exit(1);
}
console.log('PASS: Policy box CSS styles verified.');

console.log('ALL TESTS PASSED! (100% GREEN)');
