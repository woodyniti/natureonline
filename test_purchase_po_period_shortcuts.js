const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const periodStart = html.indexOf("let _poPeriodMode = 'default';");
const periodEnd = html.indexOf('let _pendingPOCardTimer = null;',periodStart);
const dateStart = html.indexOf('function pendingPOCardToday()',periodEnd);
const dateEnd = html.indexOf('async function fetchPendingPOsAcrossMonths()',dateStart);
assert.ok(periodStart > 0 && periodEnd > periodStart && dateStart > 0 && dateEnd > dateStart);

const poRows = [
  {id:'1',po_no:'PO-2025',po_date:'2025-12-10',status:'sent'},
  {id:'2',po_no:'PO-FEB',po_date:'2026-02-15',status:'received'},
  {id:'3',po_no:'PO-NOV',po_date:'2026-11-01',status:'sent'},
  {id:'4',po_no:'PO-NOV-2',po_date:'2026-11-05',status:'received'}
].map(po=>({...po,note:'',supplier_name:'Supplier',total_amount:100,expected_date:null}));
const nodes = Object.fromEntries(['po-period-shortcuts','po-list','po-from','po-to','po-status','po-search','po-sort'].map(id=>[id,{value:'',innerHTML:'',isConnected:true}]));
nodes['po-sort'].value='date_desc';
nodes['po-from'].value='2026-11-01';
nodes['po-to'].value='2026-11-08';

const context = {
  currentShop:{id:'shop-1'},document:{getElementById:id=>nodes[id]||null},
  sb:{from:table=>{
    const query={table,fields:'',filters:[],select(fields){this.fields=fields;return this},
      eq(field,value){this.filters.push([field,'eq',value]);return this},
      gte(field,value){this.filters.push([field,'gte',value]);return this},
      lte(field,value){this.filters.push([field,'lte',value]);return this},
      in(field,values){this.filters.push([field,'in',values]);return this},
      order(){return this},
      range(first,last){return Promise.resolve({data:(this.table==='stock_movements'?[]:poRows).slice(first,last+1),error:null})},
      then(resolve){
        const data=(this.table==='stock_movements'?[]:poRows).filter(po=>this.filters.every(([field,op,value])=>
          field==='shop_id'||(op==='eq'?po[field]===value:op==='gte'?po[field]>=value:op==='lte'?po[field]<=value:value.includes(po[field]))));
        resolve({data,error:null});
      }
    };
    return query;
  }},
  schedulePendingPOCardRefresh:()=>{},getPOSupplierRef:()=>'',getCleanPONote:()=>'',
  smartWildcardMatch:()=>false,poBadge:status=>status,escapeHTML:String,toast:()=>{},console
};
vm.createContext(context);
vm.runInContext(html.slice(periodStart,periodEnd)+html.slice(dateStart,dateEnd),context);
vm.runInContext('pendingPOCardToday = () => "2026-11-08"',context);

(async()=>{
  await vm.runInContext('loadPOPeriodShortcuts()',context);
  assert.match(nodes['po-period-shortcuts'].innerHTML,/setPOPeriodYear\(2025\)/);
  assert.match(nodes['po-period-shortcuts'].innerHTML,/พ\.ย\. <small>\(2\)<\/small>/);

  await vm.runInContext('setPOPeriodMonth(2025,12)',context);
  assert.equal(nodes['po-from'].value,'2025-12-01');
  assert.equal(nodes['po-to'].value,'2025-12-31');
  assert.match(nodes['po-list'].innerHTML,/PO-2025/);
  assert.doesNotMatch(nodes['po-list'].innerHTML,/PO-NOV/);

  await vm.runInContext('setPOPeriodYear(2026)',context);
  assert.equal(nodes['po-from'].value,'2026-01-01');
  assert.equal(nodes['po-to'].value,'2026-12-31');
  assert.match(nodes['po-list'].innerHTML,/PO-NOV/);
  assert.match(nodes['po-list'].innerHTML,/PO-FEB/);
  assert.doesNotMatch(nodes['po-list'].innerHTML,/PO-2025/);

  await vm.runInContext('setPOPeriodMonth(2024,2)',context);
  assert.equal(nodes['po-to'].value,'2024-02-29');

  await vm.runInContext('setPOPeriodDefault()',context);
  assert.match(nodes['po-list'].innerHTML,/PO-2025/); // default view still includes open POs from older months
  await vm.runInContext('clearPOFilter()',context);
  assert.equal(nodes['po-from'].value,'');
  assert.match(nodes['po-list'].innerHTML,/PO-2025/);
  console.log('Purchase PO period shortcuts: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
