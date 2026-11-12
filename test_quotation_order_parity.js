const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

console.log('--- 1. Testing Version & Changelog ---');
assert.match(html, /const CURRENT_APP_VERSION = 'sealthai-v3\.(4[4-9]|[5-9]\d)';/, 'Version should be at least sealthai-v3.44');
assert.match(html, /const DISPLAY_APP_VERSION = 'v3\.(4[4-9]|[5-9]\d)';/, 'Display version should be at least v3.44');
assert.match(html, /v3\.(4[4-9]|[5-9]\d) 🚀 System Active/, 'Active version badge should be at least v3.44');
assert.ok(html.includes("v:'3.44'"), 'Changelog must contain v3.44 entry');
console.log('✓ Version and Changelog verified');

console.log('--- 2. Testing Modal Quote Form Fields Parity ---');
assert.ok(html.includes('id="qt-channel"'), 'modal-quote must have #qt-channel');
assert.ok(html.includes('id="qt-pay"'), 'modal-quote must have #qt-pay');
assert.ok(html.includes('id="qt-username"'), 'modal-quote must have #qt-username');
assert.ok(html.includes('id="qt-customer-po"'), 'modal-quote must have #qt-customer-po');

// Check options in qt-channel match o-channel
const qtChannelBlock = html.match(/<select id="qt-channel">([\s\S]*?)<\/select>/);
assert.ok(qtChannelBlock, 'Must find #qt-channel select');
['Facebook', 'Shopee', 'Lazada', 'LINE', 'TikTok', 'Thaimart', 'Offline', 'อื่นๆ'].forEach(opt => {
  assert.ok(qtChannelBlock[1].includes(opt), `qt-channel must include ${opt}`);
});

// Check options in qt-pay match o-pay
const qtPayBlock = html.match(/<select id="qt-pay">([\s\S]*?)<\/select>/);
assert.ok(qtPayBlock, 'Must find #qt-pay select');
['โอนเงิน', 'COD', 'บัตรเครดิต', 'เงินสด'].forEach(opt => {
  assert.ok(qtPayBlock[1].includes(opt), `qt-pay must include ${opt}`);
});
console.log('✓ Modal Quote Form fields parity with Order verified');

console.log('--- 3. Testing getQuoteMeta Parsing ---');
assert.ok(html.includes('channel: channel'), 'getQuoteMeta should return channel');
assert.ok(html.includes('customer_username: customerUsername'), 'getQuoteMeta should return customer_username');
assert.ok(html.includes('customer_po_no: customerPoNo'), 'getQuoteMeta should return customer_po_no');
assert.ok(html.includes('payment_method: paymentMethod'), 'getQuoteMeta should return payment_method');

// Simulate getQuoteMeta logic
function simulateGetQuoteMeta(qt) {
  let channel = String(qt?.channel || 'LINE');
  let customerUsername = String(qt?.customer_username || '');
  let customerPoNo = String(qt?.customer_po_no || '');
  let paymentMethod = String(qt?.payment_method || 'โอนเงิน');
  let cleanNote = String(qt?.note || '');

  if (cleanNote.includes('<!--QT_META:') || cleanNote.includes('[QT_META:')) {
    const match = cleanNote.match(/(?:<!--|\[)QT_META:(\{.*?\})(?:-->|\])/);
    if (match) {
      const meta = JSON.parse(match[1]);
      if (meta.channel) channel = meta.channel;
      if (meta.customer_username != null) customerUsername = meta.customer_username;
      if (meta.customer_po_no != null) customerPoNo = meta.customer_po_no;
      if (meta.payment_method) paymentMethod = meta.payment_method;
      cleanNote = cleanNote.replace(/(?:<!--|\[)QT_META:(\{.*?\})(?:-->|\])/g, '').trim();
    }
  }

  return { channel, customer_username: customerUsername, customer_po_no: customerPoNo, payment_method: paymentMethod, note: cleanNote };
}

const testQtWithMeta = {
  quote_no: 'QT2026-00007',
  note: 'ทดสอบหมายเหตุ\n<!--QT_META:{"channel":"TikTok","payment_method":"COD","customer_username":"@tiktok_buyer","customer_po_no":"PO-9999"}-->'
};
const parsedMeta = simulateGetQuoteMeta(testQtWithMeta);
assert.equal(parsedMeta.channel, 'TikTok');
assert.equal(parsedMeta.payment_method, 'COD');
assert.equal(parsedMeta.customer_username, '@tiktok_buyer');
assert.equal(parsedMeta.customer_po_no, 'PO-9999');
assert.equal(parsedMeta.note, 'ทดสอบหมายเหตุ');
console.log('✓ getQuoteMeta simulation passed');

console.log('--- 4. Testing openNewQuote, openEditQuote & duplicateQuote ---');
assert.ok(html.includes("set('qt-channel', 'LINE')"), 'openNewQuote must default qt-channel to LINE');
assert.ok(html.includes("set('qt-pay', 'โอนเงิน')"), 'openNewQuote must default qt-pay to โอนเงิน');
assert.ok(html.includes("set('qt-channel', meta.channel || qt.channel || 'LINE')"), 'openEditQuote / duplicateQuote must set channel');
assert.ok(html.includes("set('qt-pay', meta.payment_method || qt.payment_method || 'โอนเงิน')"), 'openEditQuote / duplicateQuote must set pay');
assert.ok(html.includes("set('qt-username', meta.customer_username || qt.customer_username || '')"), 'openEditQuote / duplicateQuote must set username');
assert.ok(html.includes("set('qt-customer-po', meta.customer_po_no || qt.customer_po_no || '')"), 'openEditQuote / duplicateQuote must set customer-po');
console.log('✓ openNewQuote, openEditQuote, duplicateQuote tested successfully');

console.log('--- 5. Testing saveQuote & viewQuote ---');
assert.ok(html.includes("const channel = document.getElementById('qt-channel')?.value || 'LINE';"), 'saveQuote should read qt-channel');
assert.ok(html.includes("const paymentMethod = document.getElementById('qt-pay')?.value || 'โอนเงิน';"), 'saveQuote should read qt-pay');
assert.ok(html.includes("const customerUsername = document.getElementById('qt-username')?.value || '';"), 'saveQuote should read qt-username');
assert.ok(html.includes("const customerPoNo = document.getElementById('qt-customer-po')?.value || '';"), 'saveQuote should read qt-customer-po');
assert.ok(html.includes("PO: <b style=\"color:var(--blue)\">' + escapeHTML(meta.customer_po_no)"), 'viewQuote should render customer_po_no');
console.log('✓ saveQuote and viewQuote tested successfully');

console.log('--- 6. Testing convertToOrder & importQuoteToOrder ---');
assert.ok(html.includes("channel: meta.channel || qt.channel || 'LINE'"), 'convertToOrder must use meta.channel');
assert.ok(html.includes("payment_method: meta.payment_method || 'โอนเงิน'"), 'convertToOrder must use meta.payment_method');
assert.ok(html.includes("customer_username: meta.customer_username || null"), 'convertToOrder must use meta.customer_username');
assert.ok(html.includes("customer_po_no: meta.customer_po_no || null"), 'convertToOrder must use meta.customer_po_no');
assert.ok(html.includes("if (qMeta.channel) set('o-channel', qMeta.channel);"), 'importQuoteToOrder must set o-channel');
assert.ok(html.includes("if (qMeta.payment_method) set('o-pay', qMeta.payment_method);"), 'importQuoteToOrder must set o-pay');
assert.ok(html.includes("if (qMeta.customer_username) set('o-username', qMeta.customer_username);"), 'importQuoteToOrder must set o-username');
assert.ok(html.includes("if (qMeta.customer_po_no) set('o-customer-po', qMeta.customer_po_no);"), 'importQuoteToOrder must set o-customer-po');
console.log('✓ convertToOrder and importQuoteToOrder tested successfully');

console.log('--- 7. Testing Customer Autocomplete fillQuoteCustomer ---');
assert.ok(html.includes("user: 'qt-username'"), 'fillQuoteCustomer must map user to qt-username');
console.log('✓ fillQuoteCustomer autocomplete tested successfully');

console.log('\n==========================================');
console.log('🎉 ALL QUOTATION-ORDER PARITY TESTS PASSED!');
console.log('==========================================');
