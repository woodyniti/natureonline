const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const stockStart = html.indexOf('async function applyPOsToStock()');
const stockEnd = html.indexOf('\nasync function openStockModal(', stockStart);
assert.ok(stockStart > 0 && stockEnd > stockStart);
const stock = html.slice(stockStart, stockEnd);
assert.match(stock, /from\('purchase_order_items'\)[\s\S]*?\.in\('po_id', selectedPOs\.map\(po => po\.id\)\)\.order\('id', \{ ascending:true \}\)/);
assert.match(stock, /linesByPO\.get\(it\.po_id\)\?\.push\(it\)/);
assert.match(stock, /\(linesByPO\.get\(po\.id\)\|\|\[\]\)\.forEach\(\(it, lineIndex\) =>/);
assert.match(stock, /po_line_no:lineIndex\+1/);
assert.match(html, /บรรทัดที่ \$\{row\.po_line_no\}/);

const directStart = html.indexOf('async function openGR(poId)');
const directEnd = html.indexOf('\nwindow.toggleGRCurrency', directStart);
assert.ok(directStart > 0 && directEnd > directStart);
const direct = html.slice(directStart, directEnd);
assert.match(direct, /\.order\('id'\)/);
assert.match(direct, /po_line_no:index\+1/);
assert.match(direct, /#\$\{it\.po_line_no\}/);
console.log('PO receipt line ordering and numbering: OK');
