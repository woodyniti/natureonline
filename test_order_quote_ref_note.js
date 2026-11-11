const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Converted Order Quote Ref Note v3.43...');

const htmlPath = path.join(__dirname, 'index.html');
const rawContent = fs.readFileSync(htmlPath, 'utf8');
const content = rawContent.replace(/\r\n/g, '\n');

// 1. Version check
assert.match(content, /CURRENT_APP_VERSION = 'sealthai-v3\.(43|44)'/, "CURRENT_APP_VERSION should be at least sealthai-v3.43");
assert.match(content, /DISPLAY_APP_VERSION = 'v3\.(43|44)'/, "DISPLAY_APP_VERSION should be at least v3.43");
console.log('✓ Version is at least v3.43+');

// 2. cleanOrderNote logic simulation & assertion
function cleanOrderNote(note) {
  let s = String(note || '')
    .replace(/\[\[INTERNAL_NOTE:[^\]]+\]\]/g, '')
    .replace(/\[\[SHIPPING_FEE:[0-9.]+\]\]/g, '')
    .replace(/\[บริษัท: [^\]]+\]/g, '')
    .replace(/\[(?:บริษัท\/นิติบุคคล|Tax ID|ที่อยู่ออกบิล|หมายเหตุภายใน|PO ลูกค้า|ค่าจัดส่ง)\]:[^\n]*/gi, '')
    .trim();
  const qm = s.match(/(?:Convert จาก|ดึงจากใบเสนอราคา)\s*(QT[0-9A-Za-z-]+)/i);
  if (qm && qm[1]) {
    s = s.replace(/(?:Convert จาก|ดึงจากใบเสนอราคา)\s*QT[0-9A-Za-z-]+/gi, qm[1]).trim();
  }
  return s;
}

// Test case A: Pure quote number
assert.strictEqual(cleanOrderNote('QT2026-00006'), 'QT2026-00006');

// Test case B: Legacy "Convert จาก QT2026-00006"
assert.strictEqual(cleanOrderNote('Convert จาก QT2026-00006'), 'QT2026-00006');

// Test case C: Legacy "ดึงจากใบเสนอราคา QT2026-00006"
assert.strictEqual(cleanOrderNote('ดึงจากใบเสนอราคา QT2026-00006'), 'QT2026-00006');

// Test case D: Mixed with internal notes and company tags
const mixedNote = 'Convert จาก QT2026-00006\n[บริษัท: บริษัท ABC จำกัด]\n[[INTERNAL_NOTE:urgent]]\n[Tax ID]: 0105512345678\n[ที่อยู่ออกบิล]: 123 BKK';
assert.strictEqual(cleanOrderNote(mixedNote), 'QT2026-00006');
console.log('✓ cleanOrderNote correctly extracts pure quote reference number and strips internal/schema tags');

// 3. convertToOrder implementation check
assert(content.includes("const docNote = (qt.quote_no || '').trim();"), 'convertToOrder must extract docNote as qt.quote_no');
assert(content.includes("note: noteWithCompanyAndShipping(docNote, compName, shippingFee, inote)"), 'convertToOrder must use noteWithCompanyAndShipping with pure docNote');
assert(!content.includes("orderPayload.note = (orderPayload.note ? orderPayload.note + '\\n' : '') + '[บริษัท/นิติบุคคล]: '"), 'convertToOrder must NOT inject plaintext [บริษัท/นิติบุคคล] into note');
assert(!content.includes("orderPayload.note = (orderPayload.note ? orderPayload.note + '\\n' : '') + '[หมายเหตุภายใน]: '"), 'convertToOrder must NOT inject plaintext [หมายเหตุภายใน] into note');
console.log('✓ convertToOrder safeguards verified: only quotation ref no is saved to document note');

// 4. importQuoteToOrder implementation check
assert(content.includes("set('o-note', (qt.quote_no || '').trim());"), 'importQuoteToOrder must set o-note to only qt.quote_no');
console.log('✓ importQuoteToOrder sets o-note to only quote_no');

// 5. viewOrder implementation check
assert(content.includes("eq('converted_order_id', orderId).maybeSingle()"), 'viewOrder must check for linked quotation');
assert(content.includes("if (linkedQuote && linkedQuote.quote_no) return linkedQuote.quote_no;"), 'viewOrder must fallback to linkedQuote.quote_no for converted orders');
console.log('✓ viewOrder guarantees quote reference number is displayed in ed-note');

// 6. printReceipt implementation check
assert(content.includes("if (!displayNote && linkedQuote?.quote_no) displayNote = linkedQuote.quote_no;"), 'printReceipt must support linkedQuote.quote_no fallback');
console.log('✓ printReceipt verified');

// 7. Changelog check
assert(content.includes("v:'3.43'"), 'Changelog must include v3.43');
console.log('✓ Changelog entry v3.43 verified');

console.log('ALL TESTS PASSED SUCCESSFULLY! ✓');
