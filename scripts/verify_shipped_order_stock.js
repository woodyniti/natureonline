// Read-only live check: node scripts/verify_shipped_order_stock.js SO-... 9 10
const fs = require('node:fs');
const path = require('node:path');
const [orderNo, expectedStockText, expectedPostedText] = process.argv.slice(2);
if (!orderNo || expectedStockText === undefined || expectedPostedText === undefined) {
  console.error('Usage: node scripts/verify_shipped_order_stock.js ORDER_NO EXPECTED_STOCK EXPECTED_OUT_QTY');
  process.exit(2);
}
const env = {};
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
async function read(table, params) {
  const url = new URL('/rest/v1/' + table, env.SUPABASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
  }});
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  return response.json();
}
async function main() {
  const orders = await read('orders', {
    select: 'id,shop_id,order_no,shipping_status,order_items(product_id,qty)',
    order_no: 'eq.' + orderNo, limit: '2'
  });
  if (orders.length !== 1) throw new Error(`Expected one order ${orderNo}, found ${orders.length}`);
  const order = orders[0];
  const items = (order.order_items || []).filter(item => item.product_id && Number(item.qty) > 0);
  if (items.length !== 1) throw new Error(`Expected one stock item, found ${items.length}`);
  const [item] = items;
  const [products, movements] = await Promise.all([
    read('products', {select:'id,sku,stock_qty', id:'eq.' + item.product_id, limit:'2'}),
    read('stock_movements', {select:'id,shop_id,product_id,qty,move_type,note',
      product_id:'eq.' + item.product_id, note:'ilike.*' + orderNo + '*', limit:'1000'})
  ]);
  if (products.length !== 1) throw new Error('Product not found');
  const related = movements.filter(m => m.shop_id === order.shop_id && m.move_type === 'out' &&
    String(m.note || '').includes(orderNo));
  const posted = related.reduce((sum, m) => sum + Math.abs(Number(m.qty || 0)), 0);
  const observed = {orderNo, status:order.shipping_status, sku:products[0].sku,
    orderQty:Number(item.qty), stockQty:Number(products[0].stock_qty), outboundMovements:related.length, postedQty:posted};
  console.log(JSON.stringify(observed));
  if (!['shipped','delivered'].includes(observed.status) ||
      observed.stockQty !== Number(expectedStockText) ||
      observed.postedQty !== Number(expectedPostedText)) process.exitCode = 1;
}
main().catch(error => {console.error(error.message); process.exitCode = 1;});
