const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const page = fs.readFileSync('index.html','utf8');
const begin = page.indexOf('async function planBomShipmentMovements(');
const end = page.indexOf('\nasync function syncOrderPhysicalStock(',begin);
assert.ok(begin>=0 && end>begin);
const bomScript = fs.readFileSync('silicone_kit_bom.js','utf8');
const bom = {version:1,stock_mode:'purchased_box',components:[
  {sku:'PART-A',name:'A',qty:2,allocated_unit_cost:5},
  {sku:'PART-B',name:'B',qty:1,allocated_unit_cost:10}
]};
const kit = {id:'kit',sku:'KIT',stock_qty:0,current_cost:20,
  application_note:'[[BOM64:'+Buffer.from(JSON.stringify(bom)).toString('base64')+']]'};
const parts = [{id:'a',sku:'PART-A',stock_qty:2,current_cost:5},
  {id:'b',sku:'PART-B',stock_qty:1,current_cost:10}];
const context = {
  atob,TextDecoder,console,
  currentShop:{id:'shop'},today:()=> '2026-11-24',
  sb:{from(table) {
    assert.equal(table,'products');
    return {select(){return this;},eq(){return this;},
      in(column,values) {this.column=column;this.values=values;return this;},
      then(resolve,reject) {
        const list = this.column==='id' ? [kit,...parts].filter(p => this.values.includes(p.id))
          : parts.filter(p => this.values.includes(p.sku));
        return Promise.resolve({data:list,error:null}).then(resolve,reject);
      }
    };
  }}
};
vm.createContext(context);
vm.runInContext(bomScript+'\n'+page.slice(begin,end),context);

(async () => {
  assert.equal(context.getBomVirtualBoxCount(kit,parts),1);
  const costs = context.calculateBomComponentCosts(bom,1,20);
  assert.equal(costs.length,2);
  assert.equal(costs[0].unitCost,5);
  assert.equal(costs[1].unitCost,10);
  assert.ok(Math.abs(costs.reduce((sum,p) => sum+p.total,0)-20)<0.001);
  const twoBoxes = context.calculateBomComponentCosts(bom,2,20);
  assert.equal(twoBoxes[0].qty,4);
  assert.equal(twoBoxes[1].qty,2);
  assert.ok(Math.abs(twoBoxes.reduce((sum,p) => sum+p.total,0)-40)<0.001);
  const fallback = context.calculateBomComponentCosts({...bom,components:bom.components.map(p => ({...p,allocated_unit_cost:0}))},1,30);
  assert.equal(fallback[0].unitCost,10);
  assert.equal(fallback[1].unitCost,10);
  const order = {order_date:'2026-11-24'};
  const line = {product_id:'kit',shipped_qty:1,cost_per_unit:20};
  const plan = await context.planBomShipmentMovements(order,[line],[],'ขาย SO-TEST');
  assert.equal(plan.newMoves.length,2);
  assert.deepEqual(Array.from(plan.newMoves, m => [m.product_id,m.qty]),[['a',2],['b',1]]);
  await assert.rejects(() => context.planBomShipmentMovements(order,[{...line,shipped_qty:2}],[],'ขาย SO-TEST'),/สต๊อก BOM\/ชิ้นส่วนไม่พอ/);
  kit.stock_qty=1;
  parts[0].stock_qty=0;parts[1].stock_qty=0;
  const physical = await context.planBomShipmentMovements(order,[line],[],'ขาย SO-TEST');
  assert.equal(physical.newMoves.length,1);
  assert.equal(physical.newMoves[0].product_id,'kit');
  const reversal = await context.planBomShipmentMovements(order,[],physical.newMoves,'ขาย SO-TEST');
  assert.equal(reversal.newMoves.length,0);
  assert.ok(reversal.affectedIds.includes('kit'));
  kit.stock_qty=0;
  parts[0].stock_qty=2;parts[1].stock_qty=1;
  await assert.rejects(() => context.planBomShipmentMovements(order,[line,{product_id:'a',shipped_qty:1,cost_per_unit:5}],[],'ขาย SO-TEST'),/สต๊อก BOM\/ชิ้นส่วนไม่พอ/);
  console.log('BOM virtual stock and shipment plan: OK');
})().catch(error => {console.error(error);process.exitCode=1;});
