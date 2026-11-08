const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function getStockPOAutoDiscountTHB()');
const end = html.indexOf('\nfunction updateStockTotal()', start);
assert.ok(start > 0 && end > start);
assert.match(html, /rowNetGoodsAmt = rowGoodsAmt - discountShare/);
assert.match(html, /\|DISC:\s*' \+ discountShare\.toFixed\(2\)/);
assert.match(html, /discountTHB > productSubtotalTHB/);

const input = { value: '10', style: {} };
const type = { value: 'amount' };
const hint = { textContent: '' };
const poList = { _poData: [] };
const context = {
  document: { getElementById: id => ({
    's-discount': input, 's-discount-type': type, 's-discount-hint': hint,
    's-po-list': poList,
  })[id] || null },
  stockRows: [], stockDiscountManual: true, getPOAdjustments: () => ({ discountTHB: 0 }),
  Math, Number, Set, Map,
};
vm.runInNewContext(html.slice(start, end), context);

assert.equal(context.getStockDiscountTHB(100, 'THB', 35).amount, 10);
assert.equal(context.getStockDiscountTHB(100, 'USD', 35).invalid, true);
input.value = '2';
assert.equal(context.getStockDiscountTHB(100, 'USD', 35).amount, 70);
type.value = 'percent';
input.value = '12.5';
assert.equal(context.getStockDiscountTHB(100, 'THB', 35).amount, 12.5);
input.value = '101';
assert.equal(context.getStockDiscountTHB(100, 'THB', 35).invalid, true);
input.value = '0';
assert.equal(context.getStockDiscountTHB(0, 'THB', 35).amount, 0);

poList._poData = [{ id: 'po1', discount_amount: 100,
  purchase_order_items: [{ id: 'line1', qty_ordered: 10, unit_cost: 100 }] }];
context.stockRows = [{ po_id: 'po1', po_item_id: 'line1', qty: 5, enabled: true }];
context.getPOAdjustments = po => ({ discountTHB: po.discount_amount });
context.stockDiscountManual = false;
type.value = 'amount';
assert.equal(context.getStockDiscountTHB(500, 'THB', 35).amount, 50);
assert.equal(input.value, '50.00');

const lines = [
  { po_id: 'po1', po_item_id: 'line1', qty: 1, cost: 100 },
  { po_id: 'po2', po_item_id: 'line2', qty: 1, cost: 100 },
];
poList._poData = [
  { id: 'po1', discount_amount: 10, purchase_order_items: [{ id: 'line1', qty_ordered: 1, unit_cost: 100 }] },
  { id: 'po2', discount_amount: 50, purchase_order_items: [{ id: 'line2', qty_ordered: 1, unit_cost: 100 }] },
];
assert.deepEqual(Array.from(context.getStockDiscountShares(lines, 60, 'THB', 35)), [10, 50]);
context.stockDiscountManual = true;
assert.deepEqual(Array.from(context.getStockDiscountShares(lines, 60, 'THB', 35)), [30, 30]);

console.log('Stock receipt discount amount, USD, percent and validation: OK');

const totalEnd = html.indexOf('// ── Landed Cost rows state', end);
assert.ok(totalEnd > end);
const totals = {
  's-currency': { value:'THB' }, 's-exrate': { value:'35' },
  's-discount': { value:'30', style:{} }, 's-discount-type': { value:'amount' },
  's-vat-on': { checked:false }, 's-vat-type': { value:'excluded' },
  's-goods-total': { textContent:'' }, 's-discount-total': { textContent:'' },
  's-landed-total': { textContent:'' }, 's-vat-row': { style:{} },
  's-vat-amt': { textContent:'' }, 's-grand-total': { textContent:'' },
};
const totalContext = {
  document: { getElementById: id => totals[id] || null },
  stockRows: [{ qty:2, cost:100, other:0 }, { qty:1, cost:100, other:0 }],
  stockDiscountManual: true, landedCostRows: [],
  updateStockPOShippingRows: () => {},
  fmtB: n => '฿' + Number(n).toFixed(2),
  Math, Number, Set, Map,
};
vm.runInNewContext(html.slice(start, totalEnd), totalContext);
totalContext.updateStockTotal();
assert.equal(totals['s-goods-total'].innerHTML, '฿300.00');
assert.equal(totals['s-discount-total'].textContent, '-฿30.00');
assert.equal(totals['s-grand-total'].textContent, '฿270.00');

const saveStart = html.indexOf('let _stockSaving = false;');
const saveEnd = html.indexOf('// ── คำนวณ stock_qty', saveStart);
assert.ok(saveStart > 0 && saveEnd > saveStart);
const fields = {
  's-date': { value: '2026-11-08' }, 's-lot': { value: 'LOT-1' },
  's-currency': { value: 'THB' }, 's-exrate': { value: '35' },
  's-discount': { value: '30', style: {} }, 's-discount-type': { value: 'amount' },
  's-vat-on': { checked: false }, 's-vat-type': { value: 'excluded' },
  's-grand-total': { textContent: '฿270' },
};
let saved = [];
const saveContext = {
  document: { getElementById: id => fields[id] || null },
  stockRows: [
    { product_id: 'p1', product_name: 'A', qty: 2, cost: 100, other: 0, enabled: true },
    { product_id: 'p2', product_name: 'B', qty: 1, cost: 100, other: 0, enabled: true },
  ], stockDiscountManual: true, landedCostRows: [], allProducts: [], currentShop: { id: 'shop1' },
  getPOAdjustments: () => ({ discountTHB: 0 }),
  getStockPOAutoDiscountTHB: () => 0,
  confirmPOOverReceipts: () => true, decidePOReceiptStatuses: async () => new Map(),
  newGoodsReceiptNo: () => 'GR-TEST', confirm: () => true,
  sb: { from: table => ({ insert: async rows => {
    if (table === 'stock_movements') saved = rows;
    return { error: null };
  } }) },
  recalcStockQty: async () => {}, closeModal: () => {}, loadStockHistory: () => {},
  toast: () => {}, fmt: n => String(n), fmtB: n => String(n),
  Math, Number, Set, Map,
};
vm.runInNewContext(html.slice(start, end) + '\n' + html.slice(saveStart, saveEnd), saveContext);
(async () => {
  await saveContext.saveStockBatch();
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map(row => row.cost_per_unit), [90, 90]);
  assert.match(saved[0].note, /DISC:20\.00/);
  assert.match(saved[1].note, /DISC:10\.00/);
  saveContext.landedCostRows = [{ type: 'ค่าขนส่ง', amount: 30, currency: 'THB' }];
  fields['s-vat-on'].checked = true;
  await saveContext.saveStockBatch();
  assert.deepEqual(saved.map(row => row.cost_per_unit), [107, 107]);
  console.log('Stock receipt persists discount-adjusted unit costs: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
