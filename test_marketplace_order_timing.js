const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window:{}, console, Map, Set, Number, String, Array, Math, Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync('shopee_summary_module.js','utf8'),context);
vm.runInContext(fs.readFileSync('lazada_summary_module.js','utf8'),context);

assert.equal(context.marketplaceOrderLeadDays('2026-10-01 15:13','2026-10-05 11:39'),4);
assert.equal(context.marketplaceOrderLeadDays('2026-10-01','2026-10-01'),0);
assert.equal(context.marketplaceOrderLeadDays('2026-10-05','2026-10-01'),null);
assert.equal(context.marketplaceOrderLeadDays('2026-02-30','2026-03-02'),null);
assert.equal(context.marketplaceOrderLeadDays('2026-10-01',''),null);

const shopeeRows = [
  {orderId:'S-1',sku:'A',status:'สำเร็จแล้ว',orderDate:'2026-10-01 15:13',completedDate:'2026-10-05 11:39'},
  {orderId:'S-1',sku:'B',status:'สำเร็จแล้ว',orderDate:'2026-10-01 15:13',completedDate:'2026-10-05 11:39'},
  {orderId:'S-2',sku:'C',status:'รอดำเนินการ',orderDate:'2026-10-02',completedDate:''}
];
const timing=context.shopeeOrderTiming(shopeeRows);
assert.equal(timing.length,2);
assert.equal(timing.find(row=>row.ref==='S-1').days,4);
assert.equal(timing.find(row=>row.ref==='S-2').days,null);
const merged=context.mergeShopeeSummaryOrders(shopeeRows,[{orderId:'S-1',sku:'A',orderDate:'2026-10-01'}]);
assert.equal(merged.find(row=>row.sku==='A').completedDate,'2026-10-05 11:39');

const lazadaOrder=context.lazadaParseOrderRow({orderItemId:'L-1',orderNumber:'L',createTime:'30 Oct 2026 11:27',deliveredDate:'03 Nov 2026 15:47',status:'delivered'});
assert.equal(lazadaOrder.deliveredDate,'2026-11-03');
assert.equal(context.lazadaOrderTiming([lazadaOrder])[0].days,4);
assert.equal(context.lazadaOrderTiming([lazadaOrder,{...lazadaOrder,orderItemId:'L-2',deliveredDate:''}])[0].days,null);
assert.equal(context.lazadaOrderTiming([{...lazadaOrder,status:'cancelled'}])[0].days,null);

const shopeeSource=fs.readFileSync('shopee_summary_module.js','utf8');
const lazadaSource=fs.readFileSync('lazada_summary_module.js','utf8');
assert.match(shopeeSource,/เวลาที่ทำการสั่งซื้อสำเร็จ/);
assert.match(lazadaSource,/วันสั่งซื้อ → ส่งถึงลูกค้า/);
console.log('Marketplace order timing tests passed');
