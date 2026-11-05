const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function ownerDrawPaymentAudit(e) {');
const end = html.indexOf('async function drillDailyWage', start);
assert.ok(start > 0 && end > start);
const context = {};
vm.createContext(context);
vm.runInContext(html.slice(start, end), context);
const audit = context.ownerDrawPaymentAudit;

assert.deepEqual(JSON.parse(JSON.stringify(audit({
  expense_type: 'owner_draw', base_amount: 1000, paid_amount: 1000, payment_status: 'paid'
}))), { paid: 1000, recorded: 1000, needsReview: false, reason: '' });
assert.equal(audit({ expense_type:'owner_draw', base_amount:1000, paid_amount:400, payment_status:'partial' }).paid, 400);
assert.equal(audit({ expense_type:'owner_draw', base_amount:1000, paid_amount:0, payment_status:'unpaid' }).paid, 0);
assert.equal(audit({ expense_type:'owner_draw', base_amount:1000, amount:0, paid_amount:0, payment_status:'paid' }).needsReview, true);
assert.equal(audit({ expense_type:'owner_draw', base_amount:1000, paid_amount:400, payment_status:'paid' }).needsReview, true);
assert.equal(audit({ expense_type:'operating', amount:500, paid_amount:500, payment_status:'paid' }).paid, 0);
assert.equal(audit({ expense_type:'operating', amount:500, paid_amount:500, payment_status:'paid' }).needsReview, true);

assert.match(html, /amount: type === 'owner_draw' \? calc\.payable : calc\.pnl/);
assert.match(html, /include_in_profit:type === 'owner_draw' \? false/);
assert.match(html, /ownerDrawSum = ownerDrawRows\.reduce\(\(s, e\) => s \+ ownerDrawPaymentAudit\(e\)\.paid/);
assert.match(html, /dateMap\[d\]\.ownerDraw = \(dateMap\[d\]\.ownerDraw \|\| 0\) \+ audit\.paid/);
assert.match(html, /กรุณากรอกยอดจ่ายแล้วจริง/);
console.log('Owner draw paid-amount audit: OK');
