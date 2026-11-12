const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing v3.53 SAP Business One ERP Layout for Order & Quotation...');

const htmlPath = path.join(__dirname, 'index.html');
const rawContent = fs.readFileSync(htmlPath, 'utf8');
const content = rawContent.replace(/\r\n/g, '\n');

// 1. Version assertions
assert(content.includes("const CURRENT_APP_VERSION = 'sealthai-v3.53';"), 'CURRENT_APP_VERSION should be sealthai-v3.53');
assert(content.includes("const DISPLAY_APP_VERSION = 'v3.53';"), 'DISPLAY_APP_VERSION should be v3.53');
assert(content.includes("v3.53 🚀 System Active"), 'Login version badge should be v3.53');
assert(content.includes("v3.53 🚀</span>"), 'Topbar version badge should be v3.53');
assert(content.includes("{ v:'3.53', date:'2026-11-13'"), 'Changelog must include v3.53');
console.log('✓ 1. Version and Changelog verified');

// 2. switchSapTab helper function
assert(content.includes("function switchSapTab(scopeId, tabKey)"), 'switchSapTab function must be declared');
assert(content.includes("window.switchSapTab = switchSapTab;"), 'switchSapTab must be exported to window');
console.log('✓ 2. switchSapTab function declared and exported');

// 3. SAP B1 CSS Styles
assert(content.includes('.sap-window {'), '.sap-window CSS class must exist');
assert(content.includes('.sap-header-bar {'), '.sap-header-bar CSS class must exist');
assert(content.includes('.sap-panel {'), '.sap-panel CSS class must exist');
assert(content.includes('.sap-form-grid {'), '.sap-form-grid CSS class must exist');
assert(content.includes('.sap-field-row {'), '.sap-field-row CSS class must exist');
assert(content.includes('.sap-field-label {'), '.sap-field-label CSS class must exist');
assert(content.includes('.sap-link-btn {'), '.sap-link-btn CSS class must exist');
assert(content.includes('.sap-tabs {'), '.sap-tabs CSS class must exist');
assert(content.includes('.sap-tab {'), '.sap-tab CSS class must exist');
assert(content.includes('.sap-tab-pane {'), '.sap-tab-pane CSS class must exist');
assert(content.includes('.sap-footer {'), '.sap-footer CSS class must exist');
assert(content.includes('.btn-sap-update {'), '.btn-sap-update golden button CSS class must exist');
console.log('✓ 3. SAP B1 CSS Styles verified');

// 4. Order Detail SAP B1 Structure
assert(content.includes('id="sap-order-window"'), 'Order modal must contain sap-order-window');
assert(content.includes('Sales Order · ใบสั่งขาย'), 'Order modal header must have Sales Order title');
assert(content.includes('switchSapTab(\'sap-order-window\',\'contents\')'), 'Order modal must have contents tab switch');
assert(content.includes('switchSapTab(\'sap-order-window\',\'logistics\')'), 'Order modal must have logistics tab switch');
assert(content.includes('switchSapTab(\'sap-order-window\',\'accounting\')'), 'Order modal must have accounting tab switch');
assert(content.includes('switchSapTab(\'sap-order-window\',\'notes\')'), 'Order modal must have notes tab switch');
assert(content.includes('id="ed-cust"'), 'ed-cust must exist');
assert(content.includes('id="ed-contact"'), 'ed-contact must exist');
assert(content.includes('id="ed-phone"'), 'ed-phone must exist');
assert(content.includes('id="ed-ref"'), 'ed-ref must exist');
assert(content.includes('id="ed-username"'), 'ed-username must exist');
assert(content.includes('id="ed-ch"'), 'ed-ch must exist');
assert(content.includes('id="ed-date"'), 'ed-date must exist');
assert(content.includes('id="ed-delivery-date"'), 'ed-delivery-date must exist');
assert(content.includes('id="ed-doc-status"'), 'ed-doc-status must exist');
assert(content.includes('id="ed-status"'), 'ed-status must exist');
assert(content.includes('id="ed-pay"'), 'ed-pay must exist');
assert(content.includes('id="ed-items"'), 'ed-items must exist');
assert(content.includes('id="ed-address"'), 'ed-address must exist');
assert(content.includes('id="ed-track"'), 'ed-track must exist');
assert(content.includes('id="ed-customer-po"'), 'ed-customer-po must exist');
assert(content.includes('id="ed-company"'), 'ed-company must exist');
assert(content.includes('id="ed-tax-id"'), 'ed-tax-id must exist');
assert(content.includes('id="ed-billing-address"'), 'ed-billing-address must exist');
assert(content.includes('id="ed-emp"'), 'ed-emp must exist');
assert(content.includes('id="ed-note"'), 'ed-note must exist');
assert(content.includes('id="ed-internal-note"'), 'ed-internal-note must exist');
assert(content.includes('id="ed-subtotal"'), 'ed-subtotal must exist');
assert(content.includes('id="ed-bill-disc"'), 'ed-bill-disc must exist');
assert(content.includes('id="ed-shipping-fee"'), 'ed-shipping-fee must exist');
assert(content.includes('id="ed-grand-total"'), 'ed-grand-total must exist');
assert(content.includes('id="ed-profit-box"'), 'ed-profit-box must exist');
assert(content.includes('class="btn btn-sap-update" onclick="saveOrderEdit'), 'Order footer must have golden btn-sap-update button');
console.log('✓ 4. Order Detail SAP B1 layout and form bindings verified');

// 5. Quotation Modal SAP B1 Structure
assert(content.includes('id="sap-quote-window"'), 'Quote modal must contain sap-quote-window');
assert(content.includes('Sales Quotation · ใบเสนอราคาใหม่'), 'Quote modal header must have Sales Quotation title');
assert(content.includes('switchSapTab(\'sap-quote-window\',\'contents\')'), 'Quote modal must have contents tab switch');
assert(content.includes('switchSapTab(\'sap-quote-window\',\'logistics\')'), 'Quote modal must have logistics tab switch');
assert(content.includes('switchSapTab(\'sap-quote-window\',\'accounting\')'), 'Quote modal must have accounting tab switch');
assert(content.includes('switchSapTab(\'sap-quote-window\',\'notes\')'), 'Quote modal must have notes tab switch');
assert(content.includes('id="qt-cust"'), 'qt-cust must exist');
assert(content.includes('id="qt-contact"'), 'qt-contact must exist');
assert(content.includes('id="qt-contact-position"'), 'qt-contact-position must exist');
assert(content.includes('id="qt-phone"'), 'qt-phone must exist');
assert(content.includes('id="qt-contact-email"'), 'qt-contact-email must exist');
assert(content.includes('id="qt-ref"'), 'qt-ref must exist');
assert(content.includes('id="qt-username"'), 'qt-username must exist');
assert(content.includes('id="qt-channel"'), 'qt-channel must exist');
assert(content.includes('id="qt-date"'), 'qt-date must exist');
assert(content.includes('id="qt-valid"'), 'qt-valid must exist');
assert(content.includes('id="qt-pay"'), 'qt-pay must exist');
assert(content.includes('id="qt-customer-po"'), 'qt-customer-po must exist');
assert(content.includes('id="qt-emp"'), 'qt-emp must exist');
assert(content.includes('id="qt-items"'), 'qt-items must exist');
assert(content.includes('id="qt-address"'), 'qt-address must exist');
assert(content.includes('id="qt-company"'), 'qt-company must exist');
assert(content.includes('id="qt-tax-id"'), 'qt-tax-id must exist');
assert(content.includes('id="qt-billing-address"'), 'qt-billing-address must exist');
assert(content.includes('id="qt-note"'), 'qt-note must exist');
assert(content.includes('id="qt-internal-note"'), 'qt-internal-note must exist');
assert(content.includes('id="qt-subtotal"'), 'qt-subtotal must exist');
assert(content.includes('id="qt-bill-discount"'), 'qt-bill-discount must exist');
assert(content.includes('id="qt-shipping-type"'), 'qt-shipping-type must exist');
assert(content.includes('id="qt-shipping-fee"'), 'qt-shipping-fee must exist');
assert(content.includes('id="qt-total"'), 'qt-total must exist');
assert(content.includes('class="btn btn-sap-update" onclick="saveQuote(\'draft\')"'), 'Quote footer must have golden btn-sap-update button');
console.log('✓ 5. Quotation Modal SAP B1 layout and form bindings verified');

// 6. Quotation Detail View SAP B1 Structure
assert(content.includes('id="sap-quote-view-window"'), 'Quote detail view must contain sap-quote-view-window');
assert(content.includes("switchSapTab(\\'sap-quote-view-window\\',\\'contents\\')"), 'Quote view must have contents tab switch');
assert(content.includes("switchSapTab(\\'sap-quote-view-window\\',\\'logistics\\')"), 'Quote view must have logistics tab switch');
assert(content.includes("switchSapTab(\\'sap-quote-view-window\\',\\'accounting\\')"), 'Quote view must have accounting tab switch');
assert(content.includes("switchSapTab(\\'sap-quote-view-window\\',\\'notes\\')"), 'Quote view must have notes tab switch');
console.log('✓ 6. Quotation Detail View SAP B1 layout verified');

console.log('\n======================================================');
console.log('🎉 ALL v3.53 SAP BUSINESS ONE LAYOUT TESTS PASSED 100%!');
console.log('======================================================');
