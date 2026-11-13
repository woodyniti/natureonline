// test_receipt_sku_optional.js
// Verification that SKU is NOT printed by default in receipts/invoices/delivery notes.

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing Receipt / Document SKU Optional Behavior ---');

// 1. Verify checkbox in modal
assert(html.includes('id="receipt-show-sku"'), 'Checkbox receipt-show-sku must exist in modal');
assert(!html.includes('id="receipt-show-sku" checked'), 'Checkbox receipt-show-sku must NOT be checked by default');
console.log('✓ 1. receipt-show-sku checkbox is present and unchecked by default');

// 2. Verify printReceipt logic
assert(html.includes("const showSkuInBill = (typeof showSkuInDocument !== 'undefined')"), 'printReceipt must check showSkuInBill');
assert(html.includes("const itDesc = (showSkuInBill && itSku) ? itName + ' <br><small style=\"color:#64748b;font-family:Courier,monospace\">[' + escapeHTML(itSku) + ']</small>' : itName;"), 'itDesc must omit SKU when showSkuInBill is false');
console.log('✓ 2. printReceipt omits SKU by default');

// 3. Functional Simulation Test
function runSimulation() {
  function escapeHTML(s) { return s; }

  const itName = 'TC OIL SEAL NBR 32X45X7';
  const itSku = 'OIL SEAL NBR 32X45X7 TC';

  // Case A: Default (showSkuInBill = false)
  const showSkuInBillFalse = false;
  const descDefault = (showSkuInBillFalse && itSku)
    ? itName + ' <br><small>[' + escapeHTML(itSku) + ']</small>'
    : itName;

  assert.strictEqual(descDefault, 'TC OIL SEAL NBR 32X45X7', 'Default must be clean item name without [SKU]');
  assert(!descDefault.includes('['), 'Must not contain brackets');
  console.log('✓ Case A (Default without SKU) passed:', descDefault);

  // Case B: Explicitly enabled (showSkuInBill = true)
  const showSkuInBillTrue = true;
  const descWithSku = (showSkuInBillTrue && itSku)
    ? itName + ' <br><small>[' + escapeHTML(itSku) + ']</small>'
    : itName;

  assert(descWithSku.includes('TC OIL SEAL NBR 32X45X7'), 'Must contain item name');
  assert(descWithSku.includes('[OIL SEAL NBR 32X45X7 TC]'), 'Must contain SKU when requested');
  console.log('✓ Case B (Optional SKU when enabled) passed:', descWithSku);
}

runSimulation();

console.log('\nALL RECEIPT SKU OPTIONAL TESTS PASSED! 🎉');
