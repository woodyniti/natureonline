// test_ship_to_bill_copy_v354.js
// Automated verification for Two-Way Copy between Ship-to Address and Bill-to / Company Name
// in New Order Modal, Order Detail/Edit Modal, and Quotation Modal.

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Test Suite: Two-Way Copy Ship-to <-> Bill-to (v3.54) ---');

// 1. Verify copyBetweenShipAndBill function exists in index.html
assert(html.includes('function copyBetweenShipAndBill(direction, prefix)'), 'copyBetweenShipAndBill function definition not found in index.html');
assert(html.includes('window.copyBetweenShipAndBill = copyBetweenShipAndBill;'), 'copyBetweenShipAndBill not attached to window');

console.log('✓ copyBetweenShipAndBill function definition and export present');

// 2. Verify Buttons in modal-order (New Order)
assert(html.includes("copyBetweenShipAndBill('bill-to-ship','o')"), "modal-order Logistics copy bill-to-ship missing");
assert(html.includes("copyBetweenShipAndBill('ship-to-bill','o')"), "modal-order Logistics copy ship-to-bill missing");
console.log('✓ modal-order (New Order) copy buttons verified');

// 3. Verify Buttons in modal-order-detail (Edit Order)
assert(html.includes("copyBetweenShipAndBill('bill-to-ship','ed')"), "modal-order-detail Logistics copy bill-to-ship missing");
assert(html.includes("copyBetweenShipAndBill('ship-to-bill','ed')"), "modal-order-detail Logistics copy ship-to-bill missing");
console.log('✓ modal-order-detail (Edit Order) copy buttons verified');

// 4. Verify Buttons in modal-quote (Quotation)
assert(html.includes("copyBetweenShipAndBill('bill-to-ship','qt')"), "modal-quote Logistics copy bill-to-ship missing");
assert(html.includes("copyBetweenShipAndBill('ship-to-bill','qt')"), "modal-quote Logistics copy ship-to-bill missing");
console.log('✓ modal-quote (Quotation) copy buttons verified');

// 5. Functional Simulation Test of copyBetweenShipAndBill logic
function runSimulationTest() {
  // Extract copyBetweenShipAndBill function code from index.html
  const fnMatch = html.match(/function copyBetweenShipAndBill\([\s\S]*?\}\r?\nwindow\.copyBetweenShipAndBill/);
  assert(fnMatch, 'Could not extract copyBetweenShipAndBill body');

  let toasts = [];
  function toast(msg, type) {
    toasts.push({ msg, type });
  }

  let markedOverlays = [];
  function markUnsavedForm(el) {
    if (el) markedOverlays.push(el);
  }

  // Mock DOM
  const elements = {};
  const mockOverlay = { id: 'mock-overlay' };

  function mockElement(id, initialVal = '') {
    return {
      id,
      value: initialVal,
      closest: (sel) => (sel === '.modal-overlay' ? mockOverlay : null)
    };
  }

  const document = {
    getElementById: (id) => elements[id] || null
  };

  const copyFn = new Function('direction', 'prefix', 'document', 'toast', 'markUnsavedForm', `
    ${fnMatch[0].replace('window.copyBetweenShipAndBill', '')}
    return copyBetweenShipAndBill(direction, prefix);
  `);

  ['o', 'ed', 'qt'].forEach(prefix => {
    // Case A: Ship -> Bill (copies address and sets company if empty)
    elements[`${prefix}-address`] = mockElement(`${prefix}-address`, '123/45 ถนนสุขุมวิท คลองเตย กทม. 10110');
    elements[`${prefix}-cust`] = mockElement(`${prefix}-cust`, 'บริษัท ทดสอบ จำกัด');
    elements[`${prefix}-company`] = mockElement(`${prefix}-company`, '');
    elements[`${prefix}-billing-address`] = mockElement(`${prefix}-billing-address`, '');

    toasts = [];
    markedOverlays = [];
    copyFn('ship-to-bill', prefix, document, toast, markUnsavedForm);

    assert.strictEqual(elements[`${prefix}-billing-address`].value, '123/45 ถนนสุขุมวิท คลองเตย กทม. 10110', `${prefix}: billing-address not copied`);
    assert.strictEqual(elements[`${prefix}-company`].value, 'บริษัท ทดสอบ จำกัด', `${prefix}: company not set from cust`);
    assert(toasts.some(t => t.type === 'success'), `${prefix}: toast success not called`);
    assert(markedOverlays.length > 0, `${prefix}: form not marked unsaved`);

    // Case B: Bill -> Ship (copies billing address and sets cust name if empty)
    elements[`${prefix}-address`] = mockElement(`${prefix}-address`, '');
    elements[`${prefix}-cust`] = mockElement(`${prefix}-cust`, '');
    elements[`${prefix}-company`] = mockElement(`${prefix}-company`, 'บริษัท ซีลไทย คอร์ปอเรชั่น จำกัด');
    elements[`${prefix}-billing-address`] = mockElement(`${prefix}-billing-address`, '88/9 พระราม 9 ห้วยขวาง กทม. 10310');

    toasts = [];
    markedOverlays = [];
    copyFn('bill-to-ship', prefix, document, toast, markUnsavedForm);

    assert.strictEqual(elements[`${prefix}-address`].value, '88/9 พระราม 9 ห้วยขวาง กทม. 10310', `${prefix}: ship address not copied`);
    assert.strictEqual(elements[`${prefix}-cust`].value, 'บริษัท ซีลไทย คอร์ปอเรชั่น จำกัด', `${prefix}: cust name not set from company`);
    assert(toasts.some(t => t.type === 'success'), `${prefix}: toast success not called`);
    assert(markedOverlays.length > 0, `${prefix}: form not marked unsaved`);

    // Case C: Empty source check (should show error toast and not crash)
    elements[`${prefix}-address`] = mockElement(`${prefix}-address`, '   ');
    elements[`${prefix}-cust`] = mockElement(`${prefix}-cust`, '');
    elements[`${prefix}-company`] = mockElement(`${prefix}-company`, '');
    elements[`${prefix}-billing-address`] = mockElement(`${prefix}-billing-address`, '');

    toasts = [];
    copyFn('ship-to-bill', prefix, document, toast, markUnsavedForm);
    assert(toasts.some(t => t.type === 'error'), `${prefix}: error toast should fire on empty ship-to-bill`);

    toasts = [];
    copyFn('bill-to-ship', prefix, document, toast, markUnsavedForm);
    assert(toasts.some(t => t.type === 'error'), `${prefix}: error toast should fire on empty bill-to-ship`);
  });

  console.log('✓ Functional simulation test passed for all prefixes (o, ed, qt)');
}

runSimulationTest();

console.log('\nALL TWO-WAY COPY TESTS PASSED SUCCESSFULLY! 🎉');
