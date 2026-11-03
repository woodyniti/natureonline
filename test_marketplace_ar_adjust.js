const assert = require('node:assert/strict');
global.currentShop = {id:'shop-1'};
global.getOrderShippingFee = () => 0;
global.isOrderCancelled = () => false;
global.getOrderShopeeReconciliation = () => ({status:'matched',ref:'SHOPEE-1',match:{sale:136}});
const {marketplaceSaleAdjustApply} = require('./marketplace_sale_adjust.js');

const current = {id:'order-1',shop_id:'shop-1',channel:'Shopee',customer_social:'SHOPEE-1',total_amount:138,
  order_items:[{id:'item-1',order_id:'order-1',qty:1,sell_price:138,discount:0,discount_type:'amount'}]};
const invoice = {id:'ar-1',ar_no:'AR-1',order_id:'order-1',total_amount:138,paid_amount:138,status:'paid'};
let rpcArgs = null;
global.sb = {
  from(table) { return {
    select(){return this},eq(){return this},neq(){return this},
    single(){return Promise.resolve({data:table==='orders'?current:null,error:null})},
    limit(){return Promise.resolve({data:table==='ar_invoices'?[invoice]:[],error:null})}
  }},
  rpc(name,args){assert.equal(name,'apply_marketplace_ar_sale_adjustment');rpcArgs=args;
    return Promise.resolve({data:{order_total:136,ar_total:136,paid_amount:138,overpaid:2,status:'paid'},error:null})}
};

(async()=>{
  const row = {order:{id:'order-1',total_amount:138},ar:invoice,platform:'Shopee',target:136,selected:true};
  await marketplaceSaleAdjustApply(row);
  assert.equal(rpcArgs.p_target,136);
  assert.equal(rpcArgs.p_bill_discount,2);
  assert.equal(rpcArgs.p_expected_paid,138);
  assert.equal(rpcArgs.p_source_ref,'SHOPEE-1');
  assert.equal(row.done,true);
  console.log('Linked AR price adjustment request: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
