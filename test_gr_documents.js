const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
assert.equal((html.match(/function filterStockHistory\(/g) || []).length, 1, 'document filter is not overridden');
assert.match(html, /_stockCurrentView = 'docs';\s*document\.getElementById\('topbar-actions'\)/);
assert.match(html, /\(d\.doc_no \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/);
assert.match(html, /openGRDocumentDetail\('\$\{encodeURIComponent\(d\.gr_key\)/);
assert.match(html, /note: 'GR\|' \+ receiptNoByPO\.get\(receiptGroup\) \+ '\|COST_INCLUDED'/);
assert.match(html, /note:'GR\|' \+ receiptNo \+ '\|COST_EXCLUDED'/);
assert.match(html, /\.range\(offset, offset \+ 499\)/);

const start = html.indexOf('function newGoodsReceiptNo(');
const end = html.indexOf('\nasync function loadStockHistory(', start);
assert.ok(start > 0 && end > start);
const context = { today: () => '2026-11-04', Date, Math };
vm.runInNewContext(html.slice(start, end), context);
const newNo = context.newGoodsReceiptNo('2026-11-04');
assert.match(newNo, /^GR-20261104-[A-Z0-9]{8}$/);
const legacyNo = context.legacyGoodsReceiptNo('old-document-key', '2026-10-15');
assert.match(legacyNo, /^GR-20261015-L[0-9A-F]{8}$/);
assert.equal(context.legacyGoodsReceiptNo('old-document-key', '2026-10-15'), legacyNo);
console.log('Goods receipt document list and drill-down: OK');
