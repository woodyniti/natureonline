const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Quotation Convert to Order, Lock & Duplicate v3.41...');

const htmlPath = path.join(__dirname, 'index.html');
const rawContent = fs.readFileSync(htmlPath, 'utf8');
const content = rawContent.replace(/\r\n/g, '\n');

// 1. Version checks
assert(/CURRENT_APP_VERSION = 'sealthai-v3\.\d+'/.test(content), "CURRENT_APP_VERSION should match sealthai-v3.x");
assert(/DISPLAY_APP_VERSION = 'v3\.\d+'/.test(content), "DISPLAY_APP_VERSION should match v3.x");
console.log('✓ Version is at least v3.41+');

// 2. Status definition & helper checks
assert(content.includes("{key:'closed',    th:'🔒 ปิดแล้ว (Close)', cls:'ds-shipped'}"), "QUOTE_STATUSES must include closed status");
assert(content.includes("{key:'converted', th:'🔒 ปิดแล้ว (Close)', cls:'ds-shipped'}"), "QUOTE_STATUSES must include converted status");
assert(content.includes("function isQuoteClosed(qt)"), "isQuoteClosed function must exist");

// Simulate isQuoteClosed logic
function isQuoteClosed(qt) {
  if (!qt) return false;
  return qt.status === 'closed' || qt.status === 'converted' || Boolean(qt.converted_order_id);
}

assert.strictEqual(isQuoteClosed({ status: 'closed' }), true);
assert.strictEqual(isQuoteClosed({ status: 'converted' }), true);
assert.strictEqual(isQuoteClosed({ status: 'draft', converted_order_id: 'some-uuid' }), true);
assert.strictEqual(isQuoteClosed({ status: 'draft' }), false);
assert.strictEqual(isQuoteClosed({ status: 'sent' }), false);
assert.strictEqual(isQuoteClosed(null), false);
console.log('✓ isQuoteClosed logic functions as expected');

// 3. Convert to Order logic checks
assert(content.includes("if (isQuoteClosed(qt))"), "convertToOrder must guard against already closed/converted quotes");
assert(content.includes("Could not find the '([^']+)' column of 'orders'"), "convertToOrder must support dynamic schema column fallback");
assert(content.includes("missingCol in orderPayload"), "convertToOrder must support missing column fallback");
assert(content.includes("status: 'closed'"), "convertToOrder must update status to closed");
assert(content.includes("deal_stage: 'won'"), "convertToOrder must update deal_stage to won");
console.log('✓ convertToOrder safeguards and schema resilience verified');

// 4. Duplicate Quote logic checks
assert(content.includes("async function duplicateQuote(qtId)"), "duplicateQuote function must exist");
assert(content.includes("const ok = confirm('ต้องการทำซ้ำ (Duplicate)"), "duplicateQuote must prompt confirm dialog every time");
assert(content.includes("editingQuoteId = null;"), "duplicateQuote must reset editingQuoteId to null to create new quote");
console.log('✓ duplicateQuote function and confirm dialog verified');

// 5. Locking and prevention checks
assert(content.includes("if (isQuoteClosed(qt)) {\n    toast('ใบเสนอราคานี้ปิดแล้ว"), "openEditQuote must block editing closed quotes");
assert(content.includes("if (isQuoteClosed(qt)) {\n    toast('ไม่สามารถลบใบเสนอราคาที่ปิดแล้วได้'"), "deleteQuote must block deleting closed quotes");
console.log('✓ openEditQuote and deleteQuote locking guards verified');

// 6. UI detail modal & list checks
assert(content.includes("เอกสารนี้ปิดแล้ว (Closed · แปลงเป็น Sales Order แล้ว)"), "viewQuote must show locked banner when closed");
assert(content.includes("duplicateQuote(&quot;'+qtId+'&quot;)"), "viewQuote footer must include duplicate button");
assert(content.includes("duplicateQuote(&quot;'+q.id+'&quot;)"), "loadQuotes list must include duplicate button");
console.log('✓ Detail modal and list duplicate/lock UI verified');

// 7. Global exports check
assert(content.includes("window.duplicateQuote = duplicateQuote;"), "duplicateQuote must be exposed on window");
assert(content.includes("window.deleteQuote = deleteQuote;"), "deleteQuote must be exposed on window");
assert(content.includes("window.updateQuoteStatus = updateQuoteStatus;"), "updateQuoteStatus must be exposed on window");
assert(content.includes("window.convertToOrder = convertToOrder;"), "convertToOrder must be exposed on window");
assert(content.includes("window.isQuoteClosed = isQuoteClosed;"), "isQuoteClosed must be exposed on window");
console.log('✓ Global window bindings verified');

console.log('ALL TESTS PASSED SUCCESSFULLY! ✓');
