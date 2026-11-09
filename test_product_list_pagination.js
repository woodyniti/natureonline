const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
const start=html.indexOf('// ── Product sort state');
const end=html.indexOf('\nfunction openProductStockCountModal()',start);
const elements={};
const context={
  currentProductPrintRows:[],allProducts:[],
  document:{getElementById(id){return elements[id] ||= {innerHTML:'',textContent:'',scrollIntoView(){}};}},
  fmt:String,fmtB:String,escapeHTML:String,getProductImageUrl:()=>'',getProductBom:()=>null,
  getProductPurchasePriceTHB:()=>0,getProductPurchasePriceUSD:()=>0
};
vm.runInNewContext(html.slice(start,end),context);
const rows=Array.from({length:45},(_,i)=>({id:'p'+i,name:'Item '+i,stock_qty:i}));
const ids=id=>[...elements[id].innerHTML.matchAll(/data-product-id="([^"]+)"/g)].map(m=>m[1]);
context.renderProductTable(rows);
assert.equal(ids('prod-table').length,20);
assert.deepEqual(ids('prod-table'),ids('prod-cards'));
assert.equal(ids('prod-table')[0],'p44');
assert.equal(ids('prod-table')[19],'p25');
assert.equal(context.currentProductPrintRows.length,45,'printing still uses all filtered products');
context.goProductPage(2);
assert.equal(ids('prod-table')[0],'p24');
assert.equal(ids('prod-table')[19],'p5');
assert.match(elements['prod-count'].textContent,/21–40/);
context.goProductPage(99);
assert.deepEqual(ids('prod-table'),['p4','p3','p2','p1','p0']);
context.renderProductTable(rows.slice(0,2));
assert.deepEqual(ids('prod-table'),['p1','p0'],'new filter starts at page one');
context.setProdSort('name');
assert.deepEqual(ids('prod-table'),['p0','p1'],'sort keeps current filtered set');
context.renderProductTable([]);
assert.equal(elements['prod-pagination'].innerHTML,'');
console.log('Products: 20/page, stock-desc default, navigation, filters and mobile parity: OK');
