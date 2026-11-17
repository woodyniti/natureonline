const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('async function loadOrders()');
const end = html.indexOf('\nasync function ', start + 1);
assert.ok(start >= 0 && end > start, 'order list loader exists');
const loader = html.slice(start, end);
const source = loader.match(/\(allProducts && allProducts\.length > 1000\) \? Promise\.resolve\(\{ data: allProducts \}\) : fetchAllProductsChunked\(\)|fetchAllProductsChunked\(\)/);
assert.ok(source, 'order list has a product-stock data source');
assert.match(loader, /if \(prodRes\?\.data\) \{\s*allProducts = prodRes\.data\.map\(normalizeProduct\);/, 'fresh results replace the in-memory cache even when product count is unchanged');

const detailStart = html.indexOf('async function loadEditProdList()');
const detailEnd = html.indexOf('\nfunction ', detailStart + 1);
const detailLoader = html.slice(detailStart, detailEnd);
assert.doesNotMatch(detailLoader, /if \(editProdList && editProdList\.length > 1000\) return;/,'order detail must not keep old stock when a large catalogue is cached');
assert.match(detailLoader, /const pRes = await fetchAllProductsChunked\(\);/,'order detail reloads product stock');
assert.match(loader, /ร้าน \$\{sText\}\$\{ecoStock \? ` · รวม \$\{fmt\(stockVal \+ ecoStock\)\}` : ''\}/,'order stock badge distinguishes store stock from combined EcoSeal stock');
assert.match(loader, /if \(isPoReceived\) \{[\s\S]*?sBg = isStockOut \? '#fee2e2'/,'a received PO does not mark an out-of-stock item green');

const selectProducts = new Function('allProducts', 'fetchAllProductsChunked', `return ${source[0]};`);
const staleCache = Array.from({ length: 1001 }, (_, i) => ({ id: `product-${i}`, stock_qty: 8, stock_inhouse: 8 }));
let freshFetches = 0;
const fetchFresh = () => { freshFetches++; return Promise.resolve({ data: [{ id: 'product-0', stock_qty: 2, stock_inhouse: 2 }] }); };

(async () => {
  const result = await selectProducts(staleCache, fetchFresh);
  assert.equal(freshFetches, 1, 'opening Orders must reload stock instead of reusing an old >1000-product cache');
  assert.equal(result.data[0].stock_qty, 2, 'order stock matches the latest product record');
  console.log('Order list stock source stays current: OK');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
