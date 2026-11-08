const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('// ── Inventory Posting List & Stock Movement Ledger Engine');
const end = html.indexOf('\nfunction refreshCurrentInventoryPosting()', start);
assert.ok(start > 0 && end > start);

const product = { id:'p1', name:'K21 12X16X3 NBR', sku:'K21 U-RING 12X16X3 NBR', stock_qty:1 };
const item = (id, qty) => ({ id, product_id:'p1', qty });
const orders = [
  { id:'o1', order_no:'SO-20260623-0001', order_date:'2026-06-23', shipping_status:'shipped', order_items:[item('i1',2)] },
  { id:'o2', order_no:'SO-20260713-0001', order_date:'2026-07-13', shipping_status:'shipped', order_items:[item('i2',2)] },
  { id:'o3', order_no:'SO-20261108-0007', order_date:'2026-11-08', shipping_status:'pending', order_items:[item('i3',1)] },
];
const move = (id, type, qty, date, note='') => ({ id, product_id:'p1', move_type:type, qty, move_date:date, created_at:date+'T12:00:00Z', note });
const baseline = {
  products:[product],
  stock_movements:[move('m1','in',2,'2026-06-23'), move('m2','in',2,'2026-07-13'),
    move('m3','out',2,'2026-07-13','ขาย SO-20260713-0001'), move('m4','out',1,'2026-11-08','ขาย SO-20261108-0007')],
  orders, purchase_orders:[], goods_return_items:[]
};

async function run(data = baseline, failTable = null) {
  const elements = {};
  let renderedRows = null;
  const reads = [];
  const sb = { from(table) {
    let rows = data[table] || [];
    let one = false;
    const query = {
      select() { return this; },
      eq(key, value) { if(key !== 'shop_id') rows = rows.filter(r=>r[key] === value); return this; },
      neq(key, value) { rows = rows.filter(r=>r[key] !== value); return this; },
      order() { return this; },
      range(from,to) { rows = rows.slice(from,to+1); return this; },
      limit(n) { rows = rows.slice(0,n); return this; },
      maybeSingle() { one = true; return this; },
      then(resolve,reject) {
        reads.push(table);
        return Promise.resolve({ data:one ? rows[0] : rows, error:table===failTable ? {message:'test read failure'} : null }).then(resolve,reject);
      },
      insert() { throw new Error('diagnostic view must not write'); },
      update() { throw new Error('diagnostic view must not write'); }
    };
    return query;
  }};
  const context = {
    sb, allProducts:[{...product, stock_qty:99, stock_inhouse:99}], currentShop:{id:'shop'}, window:{},
    document:{getElementById(id){ return elements[id] ||= {innerHTML:'',textContent:''}; }},
    openModal(){}, toast(){}, today:()=> '2026-11-08', fmt:String, escapeHTML:String,
    isOrderCancelled:o=>o.doc_status==='cancelled'||o.shipping_status==='cancelled',
    renderInventoryPostingTableRows:rows=>{renderedRows=rows;}, console:{warn(){},error(){}}
  };
  vm.runInNewContext(html.slice(start,end), context);
  await context.viewProductInventoryPosting('p1');
  return {rows:renderedRows, summary:elements['ipl-summary-cards'].innerHTML, reads, elements, context};
}

(async()=>{
  const result = await run();
  assert.ok(result.rows, 'ledger rendered');
  const physical = result.rows.filter(r=>!r.isPending).reduce((s,r)=>s+r.qty,0);
  assert.equal(physical,0,'pending SO must not count as a dispatched unit: receipts 4 - shipped 4 = 0');
  assert.equal(result.rows.filter(r=>r.refDoc==='SO-20261108-0007').length,1,'same pending SO appears once');
  assert.match(result.summary,/data-stock-on-hand="0"/);
  assert.match(result.summary,/data-stock-available="-1"/);
  assert.match(result.summary,/ยอดทะเบียนสินค้าไม่ตรง/);
  assert.ok(result.reads.includes('products'),'always refresh product rather than use stale cached stock');
  assert.equal(result.context.window._currentPostingProduct.stock_qty,1);
  assert.equal(result.context.window._currentPostingProduct.stock_inhouse,undefined,'drop stale cached synthetic stock fields');

  const sent = await run({...baseline, orders:orders.map(o=>({...o,shipping_status:'shipped'}))});
  assert.match(sent.summary,/data-stock-on-hand="-1"/,'shipment moves one unit from reservation to physical out');
  assert.equal(sent.rows.filter(r=>r.refDoc==='SO-20261108-0007').length,1,'shipped SO is not counted twice');
  assert.equal(sent.rows.filter(r=>r.isPending).length,0);

  const unbooked = await run({...baseline, stock_movements:baseline.stock_movements.filter(m=>m.id!=='m4')});
  assert.match(unbooked.summary,/data-stock-on-hand="0"/,'unbooked reservation never adds physical stock');
  assert.match(unbooked.summary,/data-stock-available="-1"/);

  const returned = await run({...baseline,stock_movements:[...baseline.stock_movements,
    move('r','return',2,'2026-11-08','รับคืนสินค้าขาย SO-20260713-0001'),
    move('a','adjust',-1,'2026-11-08','ตรวจนับ') ]});
  assert.match(returned.summary,/data-stock-on-hand="1"/,'return type must win over sale wording');

  const partial = await run({...baseline,stock_movements:baseline.stock_movements.map(m=>m.id==='m3'?{...m,qty:1}:m)});
  assert.match(partial.summary,/data-stock-on-hand="0"/,'legacy shipped SO supplements only the missing quantity');

  const po = {id:'po1',po_no:'PO-1',status:'partial',po_date:'2026-11-08',purchase_order_items:[{id:'pi1',product_id:'p1',qty_ordered:5,qty_received:2}]};
  const inbound = await run({...baseline, purchase_orders:[po], stock_movements:[...baseline.stock_movements, {...move('p','in',1,'2026-11-08'),po_id:'po1'}]});
  assert.match(inbound.summary,/data-stock-on-hand="2"/,'partial receipt fallback covers only unposted quantity');
  assert.match(inbound.summary,/data-stock-available="1"/,'unreceived PO stock is not available now');

  const empty = await run({...baseline, products:[{...product,stock_qty:7}],stock_movements:[],orders:[]});
  assert.match(empty.summary,/data-stock-on-hand="unknown"/,'missing opening history is not a confirmed zero');
  assert.match(empty.summary,/ยอดตั้งต้น/);

  const failed = await run(baseline,'stock_movements');
  assert.equal(failed.rows,null);
  assert.match(failed.summary,/โหลดข้อมูลไม่ครบ/);
  assert.doesNotMatch(failed.summary,/data-stock-on-hand/,'failed query must never publish a partial balance');

  const paged = await run({...baseline,orders:[],stock_movements:Array.from({length:1001},(_,i)=>move('page'+i,'in',1,'2026-11-08'))});
  assert.match(paged.summary,/data-stock-on-hand="1001"/);
  assert.equal(paged.reads.filter(t=>t==='stock_movements').length,3,'load all history pages');

  assert.equal(result.context.inventoryMoveMatchesOrder({note:'ขาย SO-1'}, {id:'x',order_no:'SO-10'}),false,'no prefix-based document match');
  console.log('Inventory posting reconciliation: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
