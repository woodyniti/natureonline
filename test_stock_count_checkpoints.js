const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('function getStockCountTarget(');
const end=html.indexOf('\nasync function viewProductInventoryPosting(',start);
const ctx={}; vm.runInNewContext(html.slice(start,end),ctx);
const count=(target,date='2026-10-27',qty=-99)=>({id:'count',move_type:'out',qty,move_date:date,note:`[ปรับยอดสต๊อก] จาก 99 เป็น ${target} ชิ้น (ตรวจนับสต๊อกจริง)`});
const moves=[{id:'s',move_type:'out',qty:1,move_date:'2026-10-26'},count(0),count(0),count(0,'2026-10-27',99),{id:'r',move_type:'in',qty:6,move_date:'2026-10-28'}];
assert.equal(ctx.calculateStockMovementBalance(moves),6);
assert.equal(ctx.calculateStockMovementBalance([...moves].reverse()),6,'effective dates, not array order');
assert.equal(ctx.calculateStockMovementBalance([count(10),{id:'o',move_type:'out',qty:2,move_date:'2026-10-28'}]),8);
assert.equal(ctx.calculateStockMovementBalance([{move_type:'in',qty:10},{move_type:'out',qty:2}]),8,'ordinary movements remain deltas');
assert.equal(ctx.getStockCountTarget({note:'ขายสินค้า จาก 99 เป็น 0 ชิ้น'}),null);
assert.equal(ctx.getStockCountTarget({note:'[ปรับยอดสต๊อก] จาก 99 เป็น 0 ชิ้น [stock_count_target:7]'}),7);
assert.equal(ctx.getStockCountTarget({note:'[ปรับยอดสต๊อก] จาก 99 เป็น -1 ชิ้น'}),null);
assert.equal(ctx.getStockCountTarget({note:'[ปรับยอดสต๊อก] จาก 1,000 เป็น 2.5 ชิ้น'}),2.5);
assert.equal(ctx.stockMovementSignedQty({move_type:'out',qty:-3}),-3);
assert.match(html,/if \(mErr\) throw new Error\('บันทึกประวัติปรับยอดไม่สำเร็จ/);
assert.match(html,/const newQty = calculateStockMovementBalance\(moves\)/,'recalculation shares count semantics');
console.log('Stock count checkpoint and signed movement semantics: OK');

(async()=>{
  let saved;
  ctx.sb={from(table){return {
    select(){return this;},eq(){return this;},order(){return this;},range(){return this;},
    update(payload){saved=payload;return this;},
    then(resolve,reject){return Promise.resolve({data:table==='stock_movements'?moves:[],error:null}).then(resolve,reject);}
  };}};
  ctx.recomputeOrderCosts=async()=>{};
  const recalcStart=html.indexOf('async function recalcStockQty(');
  const recalcEnd=html.indexOf('\n// คำนวณ orders.total_cost',recalcStart);
  vm.runInNewContext(html.slice(recalcStart,recalcEnd),ctx);
  await ctx.recalcStockQty(['p1']);
  assert.equal(saved.stock_qty,6,'real recalc path respects repeated absolute checkpoints');

  const adjustmentStart=html.indexOf('async function openQuickAdjustStockFromPosting()');
  const adjustmentEnd=html.indexOf('\nfunction filterInventoryPostingRows()',adjustmentStart);
  let writes=0;
  const prompts=['0','ตรวจนับ'];
  const errors=[];
  const adjustment={
    _currentPostingProductId:'p1',_stockCountSaving:false,currentShop:{id:'s'},
    prompt:()=>prompts.shift(),today:()=> '2026-11-08',toast:(m)=>errors.push(m),console:{error(){}},
    sb:{from(){return {
      select(){return this;},eq(){return this;},
      maybeSingle:async()=>({data:{id:'p1',name:'Test',stock_qty:99}}),
      insert:async()=>({error:{message:'TEST insert denied'}}),
      update(){writes++;return this;}
    };}}
  };
  vm.runInNewContext(html.slice(adjustmentStart,adjustmentEnd),adjustment);
  await adjustment.openQuickAdjustStockFromPosting();
  assert.equal(writes,0,'never alter product if movement/audit insert failed');
  assert.equal(adjustment._stockCountSaving,false,'release save guard on failure');
  assert.ok(errors.some(m=>m.includes('TEST insert denied')));
  console.log('Count recalculation and failed-write safety: OK');
})().catch(e=>{console.error(e);process.exitCode=1;});
