const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const sql = fs.readFileSync('supabase_order_item_receipt_visibility_v322.sql', 'utf8');
const start = html.indexOf('function itemNet(item) {');
const end = html.indexOf('// คำนวณยอดรวมทั้งบิล', start);
assert.ok(start > 0 && end > start);
let alerts = 0;
const context = { fmtB: n => '฿' + Number(n).toFixed(2), window: { confirm: () => { alerts++; return true; } } };
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);

const oldItem = { qty: 1, sell_price: 100 };
const gift = { qty: 2, sell_price: 0, show_on_receipt: false };
const paid = { qty: 2, sell_price: 70, discount: 4, discount_type: 'amount', show_on_receipt: false };
assert.equal(context.showOrderItemOnReceipt(oldItem), true, 'Old rows remain visible');
assert.equal(context.showOrderItemOnReceipt(gift), false);
assert.equal(context.hiddenPaidReceiptItems([gift]).length, 0, 'Free gift does not trigger monetary warning');
assert.equal(context.hiddenPaidReceiptItems([gift, paid]).length, 1);
assert.match(context.hiddenReceiptWarningText([gift, paid]), /฿136\.00/);
assert.equal(context.confirmHiddenPaidReceiptItems([gift]), true);
assert.equal(alerts, 0);
assert.equal(context.confirmHiddenPaidReceiptItems([paid]), true);
assert.equal(alerts, 1);

assert.match(sql, /ADD COLUMN IF NOT EXISTS show_on_receipt boolean NOT NULL DEFAULT true/);
assert.match(html, /const visibleItems = items\.filter\(showOrderItemOnReceipt\)/);
assert.match(html, /const itemRows = visibleItems\.map/);
assert.match(html, /show_on_receipt: showOrderItemOnReceipt\(item\)/);
assert.match(html, /show_on_receipt: showOrderItemOnReceipt\(it\)/);
assert.match(html, /order_items\(id,product_id,product_name,qty,sell_price,cost_per_unit,discount,discount_type,show_on_receipt\)/);
assert.match(html, /if \(!confirmHiddenPaidReceiptItems\(items, printedLineValue\)\) return/);
assert.match(html, /editItems\.filter\(it => it\.product_id\)/);
console.log('Order item receipt visibility and free-gift stock handling: OK');
