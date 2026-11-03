const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
global.getOrderShippingFee = order => Number(order.shipping_fee || 0);
const {marketplaceSaleAdjustPlan, marketplaceSaleAdjustItemNet} = require('./marketplace_sale_adjust.js');

const order = (total, items, shipping = 0) => ({total_amount:total, order_items:items, shipping_fee:shipping});
const item = (price, qty = 1, discount = 0, discount_type = 'amount') => ({id:'item-1',sell_price:price,qty,discount,discount_type});

let plan = marketplaceSaleAdjustPlan(order(138,[item(138)]),136);
assert.equal(plan.target,136);
assert.equal(plan.billDiscount,2);
assert.equal(plan.itemChange,null);

plan = marketplaceSaleAdjustPlan(order(136,[item(138)]),140);
assert.equal(plan.itemChange.newPrice,140);
assert.equal(plan.billDiscount,0);

plan = marketplaceSaleAdjustPlan(order(195,[item(100,2),item(20,1)],5),190);
assert.equal(plan.billDiscount,35);
assert.equal(plan.shipping,5);

plan = marketplaceSaleAdjustPlan(order(90,[item(100,1,10,'percent')]),95);
assert.equal(plan.itemChange.newPrice,105.56);
assert.ok(Math.abs(marketplaceSaleAdjustItemNet(item(105.56,1,10,'percent'))-plan.billDiscount-95)<0.011);

assert.ok(marketplaceSaleAdjustPlan(order(10,[item(10)],20),5).error);
assert.ok(marketplaceSaleAdjustPlan(order(10,[]),9).error);

// Regression: the loading class used to keep the dialog children in one flex row.
let markup = '';
let loadingRemoved = false;
const content = {classList:{remove(name){if(name==='loading') loadingRemoved=true}},set innerHTML(value){markup=value}};
const context = {document:{getElementById:id=>id==='marketplace-adjust-content'?content:null},
  getOrderShippingFee:()=>0,fmtB:value=>'฿'+Number(value).toFixed(2),escapeHTML:String,console};
vm.createContext(context);
vm.runInContext(fs.readFileSync('marketplace_sale_adjust.js','utf8'),context);
vm.runInContext("_marketplaceAdjustRows=[{order:{id:'1',order_no:'SO-1',total_amount:138,customer_social:'REF-1'},platform:'Shopee',target:136,plan:{oldTotal:138,billDiscount:2,itemChange:null},selected:false}];marketplaceSaleAdjustRender()",context);
assert.equal(loadingRemoved,true);
assert.match(markup,/msa-kpis/);
assert.match(markup,/msa-mobile-list/);
assert.match(markup,/ยืนยันปรับ 0 ออเดอร์/);
console.log('Marketplace sale adjustment plans: OK');
