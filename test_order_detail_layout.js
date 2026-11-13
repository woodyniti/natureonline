const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
assert.match(html, /#modal-order-detail \.modal \{ max-width:min\(1400px,calc\(100vw - 32px\)\)/);
assert.match(html, /@media \(max-width:1100px\) \{[\s\S]*?#ed-items tr\.ed-item-row \{ display:grid/);
assert.match(html, /tr\.className = 'ed-item-row'/);
assert.match(html, /tdQty\.dataset\.label = 'จำนวน'/);
assert.match(html, /tdPrice\.dataset\.label = 'ราคา\/ชิ้น'/);
assert.match(html, /<option value="A6" selected>A6/);
assert.match(html, /const size = document\.getElementById\('ship-size'\)\?\.value \|\| 'A6'/);
assert.match(html, /isA4\?'170mm':Wstr/);
assert.match(html, /isA4\?'A4 portrait':Wstr\+' '\+Hstr/);
assert.match(html, /isA4\?'20mm':'0'/);
console.log('Order detail layout and A6 label configuration: OK');
