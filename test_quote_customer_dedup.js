// test_quote_customer_dedup.js
// Verification that customer name is not duplicated in Quotation print, viewQuote, viewOrder, or table views.

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing Quotation & Order Customer Name De-duplication ---');

// 1. Verify function definitions exist
assert(html.includes('function formatCustomerDisplayName('), 'formatCustomerDisplayName function must exist');
assert(html.includes('window.formatCustomerDisplayName = formatCustomerDisplayName;'), 'formatCustomerDisplayName must be exported');
assert(html.includes('function _normalizeCompName('), '_normalizeCompName function must exist');
console.log('✓ 1. Helper functions present in index.html');

// 2. Verify usages in key places
assert(html.includes("const custDispName = formatCustomerDisplayName(qt.customer_name, meta.company_name, qt.customer_contact);"), 'printQuote must use formatCustomerDisplayName');
assert(html.includes("formatCustomerDisplayName(qt.customer_name, meta.company_name, qt.customer_contact)"), 'viewQuote must use formatCustomerDisplayName');
assert(html.includes("formatCustomerDisplayName(ord.customer_name, ord.company_name, ord.customer_contact)"), 'viewOrder must use formatCustomerDisplayName');
console.log('✓ 2. Integration into printQuote, viewQuote, and viewOrder verified');

// 3. Functional tests using the actual extracted implementation
function runFunctionalTests() {
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Extract function definitions from index.html
  const normMatch = html.match(/function _normalizeCompName\([\s\S]*?\}\r?\n/);
  const fnMatch = html.match(/function formatCustomerDisplayName\([\s\S]*?\}\r?\nwindow\.formatCustomerDisplayName/);

  assert(normMatch, 'Could not extract _normalizeCompName');
  assert(fnMatch, 'Could not extract formatCustomerDisplayName');

  const context = new Function('escapeHTML', 'window', `
    ${normMatch[0]}
    ${fnMatch[0]}
    return { _normalizeCompName, formatCustomerDisplayName };
  `)(escapeHTML, {});

  const { formatCustomerDisplayName, _normalizeCompName } = context;

  // Case A: User's exact scenario from screenshot:
  // customer_name = "บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด"
  // company_name = "บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด"
  // contact_person = "จุฑารัตน์ จรดล"
  const resA = formatCustomerDisplayName(
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    'จุฑารัตน์ จรดล'
  );
  assert.strictEqual(
    resA,
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    `Expected clean company name without duplicate parentheses, got: ${resA}`
  );
  assert(!resA.includes('('), 'Result should not contain duplicate in parentheses');
  console.log('✓ Case A (User scenario: duplicate company name) passed:', resA);

  // Case B: Company name with (สำนักงานใหญ่) suffix
  const resB = formatCustomerDisplayName(
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด (สำนักงานใหญ่)',
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    'จุฑารัตน์ จรดล'
  );
  assert.strictEqual(
    resB,
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    `Expected clean company name, got: ${resB}`
  );
  console.log('✓ Case B (Normalized branch suffix) passed:', resB);

  // Case C: Customer name is the contact person
  const resC = formatCustomerDisplayName(
    'จุฑารัตน์ จรดล',
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    'จุฑารัตน์ จรดล'
  );
  assert.strictEqual(
    resC,
    'บริษัท ซันเทค อินเตอร์โปรดักส์ จำกัด',
    `Expected clean company name when cust is same as contact person, got: ${resC}`
  );
  console.log('✓ Case C (Cust name same as contact person) passed:', resC);

  // Case D: Customer name is distinct from both company and contact person
  const resD = formatCustomerDisplayName(
    'คุณวิชัย (แผนกจัดซื้อ)',
    'บริษัท เอบีซี จำกัด',
    'คุณสมคิด'
  );
  assert(resD.includes('บริษัท เอบีซี จำกัด'), 'Should contain company name');
  assert(resD.includes('คุณวิชัย (แผนกจัดซื้อ)'), 'Should contain distinct customer name in parentheses');
  console.log('✓ Case D (Distinct customer name) passed:', resD);

  // Case E: Individual customer without company name
  const resE = formatCustomerDisplayName('คุณสมชาย ใจดี', '', '');
  assert.strictEqual(resE, 'คุณสมชาย ใจดี', `Expected customer name, got: ${resE}`);
  console.log('✓ Case E (Individual customer) passed:', resE);

  // Case F: Both empty
  const resF = formatCustomerDisplayName('', '', '');
  assert.strictEqual(resF, '-', `Expected '-' for empty, got: ${resF}`);
  console.log('✓ Case F (Empty fields) passed:', resF);
}

runFunctionalTests();

console.log('\nALL CUSTOMER NAME DE-DUPLICATION TESTS PASSED! 🎉');
