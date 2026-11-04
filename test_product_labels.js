const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function printA4ProductLabels(');
const end = html.indexOf('\nasync function printPOItemLabels(', start);
assert.ok(start > 0 && end > start, 'shared label printer exists');
assert.match(html, /onclick="printPOItemLabels\(/);
assert.match(html, /onclick="printPendingStockLabels\(\)"/);
assert.match(html, /onclick="printGRItemLabels\(/);

let message = '';
const context = {
  toast: text => { message = text; },
  escapeHTML: value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]),
  fmt: value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
  setTimeout: callback => callback()
};
vm.runInNewContext(html.slice(start, end), context);

function popup() {
  let output = '';
  return {
    document: { open() {}, write(text) { output += text; }, close() {} },
    close() { this.closed = true; },
    focus() { this.focused = true; },
    print() { this.printed = (this.printed || 0) + 1; },
    get output() { return output; }
  };
}

let win = popup();
context.printA4ProductLabels('PO-1', [{ name: 'O-Ring 12x1.5', sku: 'OR-12', qty: 40 }], win);
assert.match(win.output, /@page\{size:A4 portrait;margin:8mm\}/);
assert.match(win.output, /O-Ring 12x1\.5/);
assert.match(win.output, /SKU: OR-12/);
assert.match(win.output, /<strong>40<\/strong> ชิ้น/);
assert.match(win.output, /A4 1 หน้า \(หน้าละ 12 ฉลาก\)/);
assert.match(win.output, /onclick="window\.print\(\)"/);
assert.match(win.output, /\.print-toolbar\{display:none\}/);
assert.match(win.output, /\.label-name\{font-size:16px/);
assert.equal(win.printed, 1);

win = popup();
context.printA4ProductLabels('GR-1', Array.from({ length: 12 }, (_, i) => ({ name: `Item ${i}`, qty: 1 })), win);
assert.equal((win.output.match(/class="sheet"/g) || []).length, 1);
assert.equal((win.output.match(/class="label"/g) || []).length, 12);
assert.match(win.output, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(win.output, /grid-template-rows:repeat\(6,minmax\(0,1fr\)\)/);

win = popup();
context.printA4ProductLabels('PO-2', Array.from({ length: 13 }, (_, i) => ({ name: `Item ${i}`, qty: 1 })), win);
assert.equal((win.output.match(/class="sheet"/g) || []).length, 2);
assert.equal((win.output.match(/class="label"/g) || []).length, 13);
assert.match(win.output, /หน้า 2\/2/);

win = popup();
context.printA4ProductLabels('PO-3', Array.from({ length: 49 }, () => ({ name: 'Item', qty: 1 })), win);
assert.equal((win.output.match(/class="sheet"/g) || []).length, 5);
assert.equal(win.closed, undefined);

console.log('A4 product labels: OK');
