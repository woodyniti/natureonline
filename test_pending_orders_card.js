const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('async function fetchPendingOrdersAcrossMonths(');
const end = html.indexOf('async function loadOrders()',start);
assert.ok(start > 0 && end > start);

const orders = Array.from({length:251},(_,i) => ({id:String(i+1),order_no:'SO-'+i,order_date:i===0?'2026-06-01':'2026-11-01',customer_name:'Customer',channel:'Shopee',shipping_status:'pending',doc_status:i===250?'cancelled':'confirmed',total_amount:100}));
let pageCalls = 0;
const card = {isConnected:true,innerHTML:''};
const context = {
  sb:{from:() => ({select(){return this},eq(){return this},or(){return this},order(){return this},range(start,end){pageCalls++;return Promise.resolve({data:orders.slice(start,end+1),error:null})}})},
  currentShop:{id:'shop-1'},_ordPendingOnly:false,isOrderCancelled:o=>o.doc_status==='cancelled'||o.shipping_status==='cancelled',
  document:{getElementById:id=>id==='ord-pending-card'?card:null},today:()=> '2026-11-03',
  fmtB:value=>'฿'+Number(value).toFixed(2),escapeHTML:String,orderChannelLogoHTML:()=>'',console
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
(async()=>{
  const pending = await vm.runInContext('fetchPendingOrdersAcrossMonths()',context);
  assert.equal(pending.length,250);
  assert.equal(pageCalls,2);
  await vm.runInContext('loadPendingOrdersCard()',context);
  assert.match(card.innerHTML,/250/);
  assert.match(card.innerHTML,/ค้างจากเดือนก่อน 1 ใบ/);
  assert.match(card.innerHTML,/ดูรายการรอจัดส่งทั้งหมด/);
  console.log('Pending orders across months: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
