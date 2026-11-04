const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function confirmPOOverReceipts(');
const end = html.indexOf('\nlet _stockSaving = false;', start);
assert.ok(start > 0 && end > start);
assert.doesNotMatch(html, /Math\.min\(Number\(cur\.qty_received\|\|0\)\+upd\.additionalQty/);
assert.match(html, /const newReceived = Number\(cur\.qty_received\|\|0\) \+ Number\(r\.qty\)/);
assert.match(html, /รับเกิน \+'/);
assert.doesNotMatch(html, /id="sr-qty-\$\{idx\}"[^\n]*max=/);
assert.doesNotMatch(html, /id="gr-qty-\$\{i\}"[^\n]* max="\$\{remaining\}"/);
assert.doesNotMatch(html, /if \(cur > maxVal\) cur = maxVal/);

const poItems = [
  { id:'a', po_id:'po1', product_name:'A', qty_ordered:10, qty_received:0 },
  { id:'b', po_id:'po1', product_name:'B', qty_ordered:5, qty_received:0 }
];
let answer = false;
let asked = '';
const context = {
  fmt:n => String(n),
  confirm:message => { asked = message; return answer; },
  sb:{ from:() => ({ select:() => ({ in:async () => ({ data:poItems, error:null }) }) }) }
};
vm.runInNewContext(html.slice(start, end), context);
assert.equal(context.confirmPOOverReceipts([{ name:'A', qty:25, remaining:10, po_no:'PO-1' }]), false);
assert.match(asked, /รับ 25 \/ คงเหลือ 10/);
answer = true;
assert.equal(context.confirmPOOverReceipts([{ name:'A', qty:25, remaining:10, po_no:'PO-1' }]), true);

const lines = [
  { po_id:'po1', po_item_id:'a', po_no:'PO-1', qty:25 },
  { po_id:'po1', po_item_id:'b', po_no:'PO-1', qty:0 }
];
(async () => {
  answer = false;
  const open = await context.decidePOReceiptStatuses(lines);
  assert.equal(open.get('po1'), 'partial');
  assert.match(asked, /1 รายการที่รับไม่ครบ/);
  answer = true;
  const closed = await context.decidePOReceiptStatuses(lines);
  assert.equal(closed.get('po1'), 'received');
  const complete = await context.decidePOReceiptStatuses([{ ...lines[0] }, { ...lines[1], qty:5 }]);
  assert.equal(complete.get('po1'), 'received');
  console.log('PO over-receipt and close/keep-open decisions: OK');
})().catch(err => { console.error(err); process.exitCode = 1; });
