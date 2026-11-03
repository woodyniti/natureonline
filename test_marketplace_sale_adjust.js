const assert = require('node:assert/strict');
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
console.log('Marketplace sale adjustment plans: OK');
