const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const listStart = html.indexOf('async function loadPOs()');
const listEnd = html.indexOf('let _pendingPOCardTimer = null;',listStart);
const dateStart = html.indexOf('function pendingPOCardToday()',listEnd);
const dateEnd = html.indexOf('async function fetchPendingPOsAcrossMonths()',dateStart);
assert.ok(listStart > 0 && listEnd > listStart && dateStart > 0 && dateEnd > dateStart);

const rows = [
  {id:'1',po_no:'PO-1',po_date:'2026-11-08',expected_date:'2026-11-15',supplier_name:'Supplier',status:'sent',total_amount:100},
  {id:'2',po_no:'PO-2',po_date:'2026-10-29',expected_date:'2026-11-17',supplier_name:'Supplier',status:'partial',total_amount:200},
  {id:'3',po_no:'PO-3',po_date:'2026-10-28',expected_date:'2026-11-01',supplier_name:'Supplier',status:'received',total_amount:300}
];
const list = {innerHTML:''};
const controls = {'po-from':'','po-to':'','po-status':'','po-search':'','po-sort':'date_desc'};
const toasts = [];
const context = {
  sb:{from:table=>({select(){return this},eq(){return this},gte(){return this},lte(){return this},in(){return this},order(){return this},
    range(){return Promise.resolve({data:table==='stock_movements'?[
      {po_id:'2',move_date:'2026-11-02'},
      {po_id:'3',move_date:'2026-11-03'},
      {po_id:'3',move_date:'2026-11-01'}
    ]:rows,error:null})},
    then(resolve){resolve({data:rows,error:null})}
  })},
  currentShop:{id:'shop-1'},
  document:{getElementById:id=>id==='po-list'?list:{value:controls[id]||''}},
  schedulePendingPOCardRefresh:()=>{},
  getPOSupplierRef:()=>'',getCleanPONote:()=>'',smartWildcardMatch:()=>false,
  poBadge:status=>status,escapeHTML:String,toast:message=>toasts.push(message),console
};
vm.createContext(context);
vm.runInContext(html.slice(listStart,listEnd)+html.slice(dateStart,dateEnd),context);
vm.runInContext('pendingPOCardToday = () => "2026-11-08"',context);

(async()=>{
  await vm.runInContext('loadPOs()',context);
  assert.match(list.innerHTML,/<th>⏱️ รอสินค้า<\/th>/);
  assert.match(list.innerHTML,/น้อยกว่า 1 วัน/);
  assert.match(list.innerHTML,/10 วัน/);
  assert.match(list.innerHTML,/ปิดรับแล้ว/);
  assert.match(list.innerHTML,/⏱️ รอสินค้า: น้อยกว่า 1 วัน/);
  assert.match(list.innerHTML,/รับจริง: 3 พ\.ย\. 2026/);
  assert.match(list.innerHTML,/เดิมคาดรับ: 1 พ\.ย\. 2026/);
  assert.match(list.innerHTML,/รับบางส่วนล่าสุด: 2 พ\.ย\. 2026/);
  assert.match(list.innerHTML,/แก้วันที่คาดว่าจะได้รับ/);
  assert.equal(toasts.length,0);
  console.log('Purchase PO wait column: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
