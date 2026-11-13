// test_sap_b1_purchasing_v355.js
// Automated verification for SAP Business One ERP Layout on PO, GRPO, AR Invoice, and AP Invoice
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Starting SAP Business One Purchasing & Invoicing (v3.55) Verification ---');

const htmlPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(htmlPath), 'index.html must exist');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Version Check
console.log('Checking version v3.55...');
assert(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.55'"), 'CURRENT_APP_VERSION must be sealthai-v3.55');
assert(html.includes("DISPLAY_APP_VERSION = 'v3.55'"), 'DISPLAY_APP_VERSION must be v3.55');
assert(html.includes('v3.55 🚀'), 'App badge should display v3.55');
assert(html.includes('ปรับโฉมหน้าต่าง PO, รับสินค้า (GRPO), AR Invoice และ AP Invoice เป็นมาตรฐาน SAP Business One ERP (v3.55)'), 'Changelog must include v3.55 entry');

// 2. CSS Width Check for SAP Modals
console.log('Checking modal CSS widths (>= 1200px)...');
assert(html.includes('#modal-po .modal') && html.includes('#modal-ap-detail .modal'), 'PO and AP modal selectors must exist');
const mediaMatch = html.match(/@media\s*\(min-width:\s*1200px\)\s*\{([\s\S]*?)\}/);
assert(mediaMatch, '@media (min-width: 1200px) must exist');
const mediaBlock = mediaMatch[1];
assert(mediaBlock.includes('#modal-po .modal'), 'modal-po must be in 1200px media query');
assert(mediaBlock.includes('#modal-grpo .modal'), 'modal-grpo must be in 1200px media query');
assert(mediaBlock.includes('#modal-stock .modal'), 'modal-stock must be in 1200px media query');
assert(mediaBlock.includes('#modal-ar-detail .modal'), 'modal-ar-detail must be in 1200px media query');
assert(mediaBlock.includes('#modal-ap-detail .modal'), 'modal-ap-detail must be in 1200px media query');
assert(mediaBlock.includes('width: 1280px') && mediaBlock.includes('min-width: 1200px'), 'Modal width must be 1280px / min 1200px on PC');

// 3. Purchase Order (Create / Edit) - modal-po
console.log('Checking modal-po layout...');
assert(html.includes('id="modal-po"'), 'modal-po must exist');
assert(html.includes('id="sap-po-edit-window"'), 'sap-po-edit-window must exist');
assert(html.includes("switchSapTab('sap-po-edit-window','contents')"), 'Tabs in sap-po-edit-window must switch correctly');
assert(html.includes('id="po-supplier-sel"'), 'po-supplier-sel input must be preserved');
assert(html.includes('id="po-date"'), 'po-date input must be preserved');
assert(html.includes('id="po-expected"'), 'po-expected input must be preserved');
assert(html.includes('id="po-currency"'), 'po-currency input must be preserved');
assert(html.includes('id="po-items"'), 'po-items container must be preserved');
assert(html.includes('id="po-subtotal"'), 'po-subtotal must be preserved');
assert(html.includes('id="po-total"'), 'po-total must be preserved');

// 4. Purchase Order View (viewPO)
console.log('Checking viewPO layout...');
assert(html.includes('id="sap-po-window"'), 'viewPO must render sap-po-window');
assert(html.includes("switchSapTab('sap-po-window','contents')"), 'viewPO must have sap-tabs');
assert(html.includes('Contents (รายการสินค้าสั่งซื้อ)'), 'viewPO Contents tab must exist');
assert(html.includes('Logistics (การจัดส่ง & ติดต่อ)'), 'viewPO Logistics tab must exist');
assert(html.includes('Accounting (ภาษี & การเงิน)'), 'viewPO Accounting tab must exist');

// 5. Stock Receive Modal (modal-stock)
console.log('Checking modal-stock layout...');
assert(html.includes('id="modal-stock"'), 'modal-stock must exist');
assert(html.includes('id="sap-stock-window"'), 'sap-stock-window must exist');
assert(html.includes('id="s-date"'), 's-date input preserved');
assert(html.includes('id="s-lot"'), 's-lot input preserved');
assert(html.includes('id="s-currency"'), 's-currency input preserved');
assert(html.includes('id="stock-rows-wrap"'), 'stock-rows-wrap container preserved');
assert(html.includes('id="s-goods-total"'), 's-goods-total preserved');
assert(html.includes('id="s-grand-total"'), 's-grand-total preserved');

// 6. Goods Receipt PO Modal (modal-grpo & openGR)
console.log('Checking modal-grpo and openGR layout...');
assert(html.includes('id="modal-grpo"'), 'modal-grpo must exist');
assert(html.includes('id="sap-grpo-window"'), 'sap-grpo-window must exist');
assert(html.includes('id="gr-date"'), 'gr-date input preserved');
assert(html.includes('id="gr-currency"'), 'gr-currency input preserved');
assert(html.includes('id="gr-items"'), 'gr-items container preserved');
assert(html.includes('id="gr-landed-rows"'), 'gr-landed-rows container preserved');

// 7. AR Invoice Detail Modal (openARDetail)
console.log('Checking openARDetail layout...');
assert(html.includes('id="sap-ar-window"'), 'sap-ar-window must exist');
assert(html.includes("switchSapTab('sap-ar-window','contents')"), 'AR tabs must exist');
assert(html.includes('openARDetail'), 'openARDetail function must exist');

// 8. AP Invoice Detail Modal (openAPDetail)
console.log('Checking openAPDetail layout...');
assert(html.includes('id="sap-ap-window"'), 'sap-ap-window must exist');
assert(html.includes("switchSapTab('sap-ap-window','contents')"), 'AP tabs must exist');
assert(html.includes('function openAPDetail(apId)'), 'openAPDetail function must exist');
assert(html.includes('openAPDetail(&quot;'), 'loadAPs must bind openAPDetail to rows');

console.log('✅ ALL SAP Business One Purchasing & Invoicing (v3.55) checks passed successfully!');
