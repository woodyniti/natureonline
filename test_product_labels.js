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
  fmt: value => Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })
};
vm.runInNewContext(html.slice(start, end), context);

function popup() {
  let output = '';
  return {
    document: { open() {}, write(text) { output += text; }, close() {} },
    close() { this.closed = true; },
    get output() { return output; }
  };
}

let win = popup();
context.printA4ProductLabels('PO-1', [{ name: 'O-Ring 12x1.5', sku: 'OR-12', qty: 40 }], win);
assert.match(win.output, /@page\{size:A4 portrait;margin:8mm\}/);
assert.match(win.output, /O-Ring 12x1\.5/);
assert.match(win.output, /SKU: OR-12/);
assert.match(win.output, /<strong>40<\/strong> ชิ้น/);
assert.match(win.output, /A4 1 หน้า/);

win = popup();
context.printA4ProductLabels('GR-1', Array.from({ length: 48 }, (_, i) => ({ name: `Item ${i}`, qty: 1 })), win);
assert.match(win.output, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(win.output, /grid-template-rows:repeat\(12,minmax\(0,1fr\)\)/);

win = popup();
context.printA4ProductLabels('PO-2', Array.from({ length: 49 }, () => ({ name: 'Item', qty: 1 })), win);
assert.equal(win.closed, true);
assert.match(message, /เกิน 48/);

console.log('A4 product labels: OK');
