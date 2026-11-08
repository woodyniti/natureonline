const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function buildProductStockCountHTML(');
const end = html.indexOf('\nasync function printProductStockCountList()', start);
assert.ok(start > 0 && end > start);
assert.match(html, /class="psc-col" value="buy"/);
assert.match(html, /class="psc-col" value="sell"/);
assert.match(html, /class="psc-col" value="inhouse" checked/);
assert.match(html, /\.range\(offset, offset \+ 499\)/);

const context = {
  escapeHTML: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  fmt: value => String(value),
  fmtB: value => '฿' + Number(value).toFixed(2),
  getProductPurchasePriceTHB: p => p.purchase_price || 0,
  getProductPurchasePriceUSD: p => p.purchase_price_usd || 0,
};
vm.runInNewContext(html.slice(start, end), context);
const page = context.buildProductStockCountHTML([
  { sku:'SKU<1', name:'O-Ring <Seal>', stock_inhouse:5, stock_ecoseal:2,
    purchase_price:12, sell_price:25, current_cost:10, location_shelf:'A1' },
], ['location','inhouse','buy','sell'], 'ตามตัวกรอง', '8 พ.ย. 2569', 'SEALTHAI');
assert.match(page, /SKU&lt;1/);
assert.match(page, /O-Ring &lt;Seal&gt;/);
assert.match(page, /คงเหลือร้าน/);
assert.match(page, /ราคาซื้อ\/ชิ้น/);
assert.match(page, /ราคาขาย\/ชิ้น/);
assert.doesNotMatch(page, /คงเหลือ EcoSeal/);
assert.match(page, /<th>นับจริง<\/th><th>ส่วนต่าง<\/th>/);
assert.match(page, /@page\{size:A4 landscape/);
console.log('Product stock count print columns, escaping and A4 layout: OK');
