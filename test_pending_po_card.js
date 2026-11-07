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
vm.runInContext('pendingPOCardToday = () => "2026-11-08"',context);

(async()=>{
  assert.equal(vm.runInContext("pendingPOCalendarDays('2026-10-29','2026-11-08')",context),10);
  assert.equal(vm.runInContext("pendingPOCalendarDays('2026-12-31','2027-01-02')",context),2);
  assert.equal(vm.runInContext("pendingPOCalendarDays('2026-02-30','2026-03-01')",context),null);
  assert.equal(vm.runInContext("pendingPODateStatus('2026-10-29','2026-11-17','2026-11-08').waitLabel",context),'รอสินค้าแล้ว 10 วัน นับจากวันที่ PO');
  assert.equal(vm.runInContext("pendingPODateStatus('2026-10-29','2026-11-17','2026-11-08').dueLabel",context),'อีก 9 วันถึงกำหนด');
  assert.equal(vm.runInContext("pendingPODateStatus('2026-10-29','2026-11-07','2026-11-08').dueLabel",context),'เลยกำหนด 1 วัน');
  assert.equal(vm.runInContext("pendingPOWaitText({status:'sent',po_date:'2026-11-08'},'2026-11-08')",context),'น้อยกว่า 1 วัน');
  assert.equal(vm.runInContext("pendingPOWaitText({status:'partial',po_date:'2026-10-29'},'2026-11-08')",context),'10 วัน');
  assert.equal(vm.runInContext("pendingPOWaitText({status:'draft',po_date:'2026-11-08'},'2026-11-08')",context),'ยังไม่ส่ง PO');
  assert.equal(vm.runInContext("pendingPOWaitText({status:'received',po_date:'2026-10-29'},'2026-11-08')",context),'ปิดรับแล้ว');
  assert.equal(vm.runInContext("pendingPODateStatus('2026-11-08','2026-11-17','2026-11-08').waitLabel",context),'รอสินค้าแล้วน้อยกว่า 1 วัน นับจากวันที่ PO');
  const rows = await vm.runInContext('fetchPendingPOsAcrossMonths()',context);
  assert.equal(rows.length,200); // fully received PO is not pending despite its status
  assert.equal(pageCalls,2); // includes older POs and more than one server page
  assert.equal(selectedStatuses.join(','),'status,sent,partial');
  await vm.runInContext('loadPendingPOCard()',context);
  assert.match(card.innerHTML,/200 <span/);
  assert.match(card.innerHTML,/ค้างรับ 1996 ชิ้น/);
  assert.match(card.innerHTML,/เลยกำหนด 1 ใบ/);
  assert.match(card.innerHTML,/วันที่คาดว่าจะได้รับ/);
  assert.match(card.innerHTML,/รอสินค้าแล้ว 160 วัน/);
  assert.match(card.innerHTML,/แก้วันคาดรับ/);
  assert.match(card.innerHTML,/&lt;O-Ring&gt;/);
  assert.match(card.innerHTML,/สั่ง 10 · รับ 4/);
  assert.match(card.innerHTML,/openGoodsReceipt/);
  assert.equal((card.innerHTML.match(/po-pending-entry/g)||[]).length,4);
  await vm.runInContext('togglePendingPOCard()',context);
  assert.equal((card.innerHTML.match(/po-pending-entry/g)||[]).length,200);

  let updatedPayload = null;
  let refreshCount = 0;
  let modalBody = '';
  const saveButton = {disabled:false,textContent:'',isConnected:true};
  const input = {value:'2026-11-18',dataset:{poDate:'2026-10-29'}};
  context.document = {
    getElementById:id=>id==='po-expected-edit'?input:id==='modal-po-detail'?{classList:{contains:()=>false}}:card,
    querySelector:()=>saveButton
  };
  context.sb = {from:()=>{
    const query = {
      select(){return updatedPayload?Promise.resolve({data:[{id:'1'}],error:null}):this},
      eq(){return this},in(){return this},
      single(){return Promise.resolve({data:{id:'1',po_no:'PO-1',po_date:'2026-10-29',expected_date:'2026-11-17',status:'sent'},error:null})},
      update(payload){updatedPayload=payload;return this}
    };
    return query;
  }};
  context.showDynamicModal = (_title,body)=>{modalBody=body};
  context.toast = ()=>{};
  context.closeModal = ()=>{};
  context.loadPOs = async()=>{refreshCount++};
  await vm.runInContext("openPOExpectedDateEditor('1')",context);
  assert.match(modalBody,/2026-11-17/);
  await vm.runInContext("savePOExpectedDate('1')",context);
  assert.equal(updatedPayload.expected_date,'2026-11-18');
  assert.equal(refreshCount,1);
  input.value='2026-10-28';
  updatedPayload=null;
  await vm.runInContext("savePOExpectedDate('1')",context);
  assert.equal(updatedPayload,null); // date before the PO is rejected
  console.log('Pending PO card: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
