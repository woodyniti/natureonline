const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window:{}, console, Map, Set, Number, String, Array, Math, currentShop:{id:'shop-1'} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('lazada_summary_module.js', 'utf8'), context);

const order = { orderItemId:'item-1', orderId:'order-1', orderDate:'2026-06-30', sellerSku:'SKU-1',
  name:'Test item', unitPrice:100, hasOrder:true, transactions:[] };
const financial = { orderItemId:'item-1', orderId:'order-1', orderDate:'2026-06-30', sellerSku:'SKU-1',
  unitPrice:0, hasOrder:false, transactions:[
    {date:'2026-07-02',statement:'July',type:'ยอดรวมค่าสินค้า',amount:100},
    {date:'2026-07-02',statement:'July',type:'Commission',amount:-10}
  ] };
const merged = context.lazadaMergeItems([order], [financial]);
assert.equal(merged.length, 1);
assert.equal(merged[0].hasOrder, true);
assert.equal(merged[0].unitPrice, 100);
assert.equal(merged[0].transactions.length, 2);
assert.equal(context.lazadaMergeItems(merged, [financial])[0].transactions.length, 2);

context._lazadaItems = merged;
context._lazadaLoadedShop = 'shop-1';
context._lazadaRefReady = true;
context._lazadaRefCounts = new Map([['ORDER-1', 1]]);
context.lazadaBuildIndex();
assert.equal(context._lazadaIndex.get('ORDER-1').sale, 100);
assert.equal(context._lazadaIndex.get('ORDER-1').payout, 90);
assert.equal(context._lazadaIndex.get('ORDER-1').fee, 10);
assert.equal(context.getOrderLazadaReconciliation({channel:'Lazada',customer_social:'order-1'}).status, 'local_only');
context._lazadaServerItemIds = new Set(['item-1']);
assert.equal(context.getOrderLazadaReconciliation({channel:'Lazada',customer_social:'order-1'}).status, 'matched');
assert.equal(context.getOrderLazadaReconciliation({channel:'Lazada',customer_social:'other'}).status, 'not_found');
console.log('Lazada summary tests passed');
