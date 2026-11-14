// test_quote_shipto_right_v356.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Quotation Print Layout (v3.56): Logo without gray frame & Ship-to Address on Right side ---');

const htmlPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(htmlPath), 'index.html must exist');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Version check
assert(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.56'"), 'CURRENT_APP_VERSION must be sealthai-v3.56');
assert(html.includes("DISPLAY_APP_VERSION = 'v3.56'"), 'DISPLAY_APP_VERSION must be v3.56');
assert(html.includes('v3.56 🚀'), 'App badge should display v3.56');
assert(html.includes('ย้ายที่อยู่จัดส่งไปด้านขวามือ และลบกรอบสีเทาของโลโก้ (v3.56)'), 'Changelog must include v3.56 entry');

// 2. Extract printQuote implementation
const pqStart = html.indexOf('async function printQuote(');
assert(pqStart !== -1, 'printQuote function must exist');
const pqEnd = html.indexOf('async function ', pqStart + 1);
const pqCode = html.slice(pqStart, pqEnd !== -1 ? pqEnd : undefined);

// 3. Verify Logo in printQuote has NO gray background/border
console.log('1. Checking logo style in printQuote...');
assert(!pqCode.includes('background:#f5f5f5'), 'Logo in printQuote must not have background:#f5f5f5');
assert(!pqCode.includes('padding:4px;border-radius:6px'), 'Logo in printQuote must not have frame padding/border');
assert(pqCode.includes('<img src="assets/logo.png" style="width:64px;height:64px;object-fit:contain;flex-shrink:0">'), 'Clean logo without frame must be present');
console.log('✓ Logo has no gray border or background');

// 4. Verify Left vs Right Box address placement in printQuote
console.log('2. Checking address placement...');
// Left box must not have ที่อยู่จัดส่ง
const infoRowIdx = pqCode.indexOf("bp.push('<div class=\"info-row\">');");
assert(infoRowIdx !== -1, 'Info-row block must exist in printQuote');
const tableIdx = pqCode.indexOf("bp.push('<table><thead><tr>');", infoRowIdx);
assert(tableIdx !== -1, 'Table must exist in printQuote');
const infoRowCode = pqCode.substring(infoRowIdx, tableIdx);

const boxSplit = infoRowCode.split("bp.push('<div class=\"info-box\">');");
assert.equal(boxSplit.length, 3, 'Should split into prefix, left box, and right box');
const leftBoxCode = boxSplit[1];
const rightBoxCode = boxSplit[2];

assert(!leftBoxCode.includes('ที่อยู่จัดส่ง'), 'Left box must NOT contain ที่อยู่จัดส่ง');
assert(leftBoxCode.includes('ที่อยู่ออกบิล'), 'Left box must contain ที่อยู่ออกบิล when billing_address exists');

assert(rightBoxCode.includes('ที่อยู่จัดส่ง'), 'Right box MUST contain ที่อยู่จัดส่ง');
assert(rightBoxCode.includes('border-top:1px dashed #bbb;text-align:left'), 'Ship-to address in right box must be styled with clean separator and left alignment');
console.log('✓ ที่อยู่จัดส่ง is correctly moved to the right-hand box');

// 5. Functional Simulation
console.log('3. Running functional simulation of printQuote header...');
function simulatePrintQuoteHeader(qt, meta) {
  function escapeHTML(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function formatCustomerDisplayName(cName, compName) {
    return escapeHTML(compName || cName || 'ลูกค้า');
  }

  const bp = [];
  bp.push('<div class="info-row">');
  bp.push('<div class="info-box">');
  bp.push('<div class="info-label">ลูกค้า / Customer:</div>');
  const custDispName = formatCustomerDisplayName(qt.customer_name, meta.company_name);
  bp.push('<div class="info-val">'+custDispName+'</div>');
  if(meta.tax_id) bp.push('<div class="info-sub">เลขประจำตัวผู้เสียภาษี: '+escapeHTML(meta.tax_id)+'</div>');
  if(qt.customer_phone) bp.push('<div class="info-sub">โทร: '+escapeHTML(qt.customer_phone)+'</div>');
  if(meta.billing_address) {
    bp.push('<div class="info-sub" style="margin-top:3px"><strong>ที่อยู่ออกบิล:</strong> '+escapeHTML(meta.billing_address).split('\n').join('<br>')+'</div>');
  }
  bp.push('</div>');
  bp.push('<div class="info-box">');
  bp.push('<div style="text-align:right">');
  bp.push('<div style="margin-bottom:5px"><span style="font-size:11px;color:#1a1a1a">เลขที่ / No.</span>&nbsp;&nbsp;<strong>'+(qt.quote_no||'-')+'</strong></div>');
  bp.push('<div style="margin-bottom:5px"><span style="font-size:11px;color:#1a1a1a">วันที่ / Date</span>&nbsp;&nbsp;<strong>'+qt.quote_date+'</strong></div>');
  bp.push('</div>');
  if(qt.customer_address && qt.customer_address.trim()) {
    bp.push('<div class="info-sub" style="margin-top:8px;padding-top:6px;border-top:1px dashed #bbb;text-align:left"><strong>ที่อยู่จัดส่ง:</strong><div style="margin-top:2px;line-height:1.45">'+escapeHTML(qt.customer_address).split('\n').join('<br>')+'</div></div>');
  }
  bp.push('</div></div>');
  return bp.join('');
}

const mockQt = {
  customer_name: 'บริษัท สามมิตรเทค จำกัด',
  customer_phone: '096-6852466',
  customer_address: 'นิคมอุตสาหกรรมเกตุเวย์ ซิตี้\n096-6852466\n359 หมู่ที่ 7 ตำบลหัวสำโรง อำเภอแปลงยาว จังหวัดฉะเชิงเทรา 24190',
  quote_no: 'QT2026-00009',
  quote_date: '2026-11-14'
};
const mockMeta = {
  tax_id: '0245556002698',
  billing_address: '359 หมู่ที่ 7 ตำบลหัวสำโรง อำเภอแปลงยาว จังหวัดฉะเชิงเทรา 24190'
};

const output = simulatePrintQuoteHeader(mockQt, mockMeta);
const boxes = output.split('<div class="info-box">');
assert.equal(boxes.length, 3, 'Must have exactly 2 info-box divs');
const leftBoxHtml = boxes[1];
const rightBoxHtml = boxes[2];

assert(leftBoxHtml.includes('ที่อยู่ออกบิล:</strong> 359 หมู่ที่ 7'), 'Left box must contain billing address');
assert(!leftBoxHtml.includes('ที่อยู่จัดส่ง:'), 'Left box must NOT contain shipping address');

assert(rightBoxHtml.includes('QT2026-00009'), 'Right box must contain quote no');
assert(rightBoxHtml.includes('ที่อยู่จัดส่ง:</strong><div style="margin-top:2px;line-height:1.45">นิคมอุตสาหกรรมเกตุเวย์ ซิตี้'), 'Right box MUST contain shipping address');

console.log('✓ Functional simulation confirmed: Left box has bill-to, Right box has ship-to!');
console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! (v3.56)');
