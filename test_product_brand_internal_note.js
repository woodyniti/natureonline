const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const addStart = html.indexOf('function productBrandNoteSchemaMessage(');
const addEnd = html.indexOf('let _editingProdXrefs = [];',addStart);
const editStart = html.indexOf('async function updateProduct(id)');
const editEnd = html.indexOf('// ── Modal ปรับแก้ต้นทุนสินค้า',editStart);
assert.ok(addStart > 0 && addEnd > addStart && editStart > 0 && editEnd > editStart);
for (const id of ['p-brand','p-internal-note','ep-brand','ep-internal-note']) {
  assert.match(html,new RegExp(`id="${id}"`));
}
const migration = fs.readFileSync('supabase_products_brand_internal_note_v328.sql','utf8');
assert.match(migration,/ADD COLUMN IF NOT EXISTS brand text/);
assert.match(migration,/ADD COLUMN IF NOT EXISTS internal_note text/);

const values = {'p-name':'Test O-Ring','p-sku':'OR-1','p-brand':'NOK','p-internal-note':'Internal purchasing note',
  'ep-name':'Test O-Ring','ep-sku':'OR-1','ep-brand':'SKF','ep-internal-note':'Revised staff note'};
const saved = {insert:null,update:null};
const toasts = [];
let updateShouldFail = false;
const context = {
  document:{getElementById:id=>id==='modal-po'?null:{value:values[id]||''},querySelectorAll:()=>[]},
  currentShop:{id:'shop-1'},currentPage:'products',allProducts:[],
  _editingProdXrefs:[],
  findProductDup:()=>null,confirm:()=>true,closeModal:()=>{},resetProductModalForm:()=>{},
  noteWithProductPrices:note=>note||'',noteWithProductSupplierCodes:note=>note,noteWithProductBuyVat:note=>note,
  normalizeProduct:p=>p,loadProducts:async()=>{},filterProducts:()=>{},uploadProductImage:async()=>null,
  toast:(message,type)=>toasts.push([message,type]),console,
  sb:{from:table=>{
    assert.ok(['products','product_cross_references'].includes(table));
    return {
      insert(payload){saved.insert=payload;return this},
      update(payload){saved.update=payload;return this},
      delete(){return this},
      eq(){return this},
      select(){return this},
      single(){return Promise.resolve({data:{id:'prod-1'},error:null})},
      then(resolve){resolve(table==='product_cross_references'?{data:[],error:null}:updateShouldFail
        ? {data:null,error:{code:'PGRST204',message:"Could not find the 'internal_note' column of 'products' in the schema cache"}}
        : {data:[{id:'prod-1'}],error:null});}
    };
  }}
};
vm.createContext(context);
vm.runInContext(html.slice(addStart,addEnd)+html.slice(editStart,editEnd),context);

(async()=>{
  await vm.runInContext('saveProduct()',context);
  assert.equal(saved.insert.brand,'NOK');
  assert.equal(saved.insert.internal_note,'Internal purchasing note');
  assert.equal(saved.insert.application_note,''); // private note is not mixed into public/spec tags

  context.allProducts=[{id:'prod-1',name:'Test O-Ring',brand:'NOK',internal_note:'Internal purchasing note'}];
  updateShouldFail=true;
  await vm.runInContext("updateProduct('prod-1')",context);
  assert.equal(saved.update.brand,'SKF');
  assert.equal(saved.update.internal_note,'Revised staff note');
  assert.ok(toasts.some(([message,type])=>type==='error'&&message.includes('supabase_products_brand_internal_note_v328.sql')));

  updateShouldFail=false;
  values['ep-brand']='';
  values['ep-internal-note']='';
  await vm.runInContext("updateProduct('prod-1')",context);
  assert.equal(saved.update.brand,null); // clearing a previously saved field persists
  assert.equal(saved.update.internal_note,null);
  assert.equal(context.allProducts[0].brand,null);
  console.log('Product brand and internal note: OK');
})().catch(error=>{console.error(error);process.exitCode=1});
