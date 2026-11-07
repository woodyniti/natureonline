const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('let _pendingPOCardTimer = null;');
const end = html.indexOf('// ── Helper: ดึงราคาซื้อสินค้าสำหรับ PO',start);
assert.ok(start > 0 && end > start);

const orders = Array.from({length:201},(_,i) => ({
  id:String(i+1),po_no:'PO-'+(i+1),po_date:i===0?'2026-06-01':'2026-11-01',
  expected_date:i===0?'2026-07-01':'2026-11-20',supplier_name:'Supplier',
  status:i===0?'partial':'sent',purchase_order_items:[{
    id:'line-'+i,product_name:i===0?'<O-Ring>':'Oil Seal',qty_ordered:10,
    qty_received:i===0?4:i===200?10:0
  }]
}));
let pageCalls = 0;
let selectedStatuses;
const card = {isConnected:true,innerHTML:''};
const context = {
  sb:{from:table => {assert.equal(table,'purchase_orders');return {
    select(){return this},eq(){return this},in(field,values){selectedStatuses=[field,...values];return this},
    order(){return this},range(first,last){pageCalls++;return Promise.resolve({data:orders.slice(first,last+1),error:null})}
  }}},
  document:{getElementById:id=>id==='po-pending-card'?card:null},
  currentShop:{id:'shop-1'},today:()=> '2026-11-08',
  fmt:v=>String(v),escapeHTML:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;'),
  poBadge:v=>v,console,setTimeout,clearTimeout
};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);

(async()=>{
  const rows = await vm.runInContext('fetchPendingPOsAcrossMonths()',context);
  assert.equal(rows.length,200); // fully received PO is not pending despite its status
  assert.equal(pageCalls,2); // includes older POs and more than one server page
  assert.equal(selectedStatuses.join(','),'status,sent,partial');
  await vm.runInContext('loadPendingPOCard()',context);
  assert.match(card.innerHTML,/200 <span/);
  assert.match(card.innerHTML,/ค้างรับ 1996 ชิ้น/);
  assert.match(card.innerHTML,/เลยกำหนด 1 ใบ/);
  assert.match(card.innerHTML,/&lt;O-Ring&gt;/);
  assert.match(card.innerHTML,/สั่ง 10 · รับ 4/);
  assert.match(card.innerHTML,/openGoodsReceipt/);
  assert.equal((card.innerHTML.match(/po-pending-entry/g)||[]).length,4);
  await vm.runInContext('togglePendingPOCard()',context);
  assert.equal((card.innerHTML.match(/po-pending-entry/g)||[]).length,200);
  console.log('Pending PO card: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
