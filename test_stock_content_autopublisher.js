const assert = require('assert');
const { buildStockContent, chooseNextProduct, slugForSku } = require('./stock_content_autopublisher');

const product = {
  id: 'p1', sku: 'OS-NB-0108', name: 'OIL SEAL NBR 28X42X6.5 BABSL',
  stock_qty: 12, sell_price: 138, material: 'NBR',
  description: 'ซีลขนาด 28×42×6.5 mm', image_url: 'https://example.com/seal.jpg'
};
const first = buildStockContent(product, 0);
const second = buildStockContent(product, 1);
assert.strictEqual(first.slug, second.slug, 'The same SKU must keep one canonical URL');
assert.strictEqual(first.slug, slugForSku(product.sku));
assert.notStrictEqual(first.content, second.content, 'A new cycle should use a new angle');
assert(first.content.includes('28×42×6.5 mm'));
assert(first.content.includes('฿138.00'));
assert(first.facebook.includes(product.sku));
assert.strictEqual(first.indexable, false, 'Thin product pages must not be indexed');
assert(!first.content.includes('200°C'), 'Do not invent material specifications');
assert(!first.content.includes('<script>'));

const malicious = buildStockContent({ ...product, name: '<script>alert(1)</script>' }, 0);
assert(!malicious.content.includes('<script>'), 'Product text must be HTML escaped');
assert(malicious.content.includes('&lt;script&gt;'));
assert.strictEqual(buildStockContent({ ...product, description: 'ข้อมูลวัสดุและขนาดจากผู้ผลิตที่ได้รับการยืนยันครบถ้วน เพื่อให้ผู้ซื้อใช้เทียบชิ้นงานก่อนสั่งซื้อ' }).indexable, true);
assert.throws(() => buildStockContent({ ...product, stock_qty: 0 }), /positive stock/);

const products = [
  product,
  { id: 'p2', sku: 'OR-01', name: 'O-RING', stock_qty: 4 },
  { id: 'p3', sku: 'OR-02', name: 'OUT OF STOCK', stock_qty: 0 }
];
const history = new Map([['p1', { cycle: 0, published_at: '2026-11-05T00:00:00Z' }]]);
assert.strictEqual(chooseNextProduct(products, history).id, 'p2', 'Publish all SKUs before repeating');
history.set('p2', { cycle: 0, published_at: '2026-11-05T01:00:00Z' });
assert.strictEqual(chooseNextProduct(products, history).id, 'p1', 'Restart at the oldest SKU after a full cycle');
assert.strictEqual(chooseNextProduct([...products, { id: 'p4', sku: 'OR-01', name: 'Duplicate SKU', stock_qty: 2 }], history).id, 'p1', 'A duplicate SKU must not create a second canonical page');
console.log('stock content autopublisher tests passed');
