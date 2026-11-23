const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('function openGRDocumentDetail(encodedKey)');
const end = html.indexOf('\nfunction renderStockTable(rows)', start);
assert.ok(start >= 0 && end > start);
const source = html.slice(start,end);

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:768,height:800}});
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(() => {
      window.allStockDocs = [{
        gr_key:'GR-TEST',doc_no:'GR-TEST',move_date:'2026-11-23',lot_name:'L1',po_no:'PO-1',
        supplier_name:'Supplier',total_qty:3,total_net_cost:90,total_base_cost:90,
        total_discount:0,total_landed_cost:0,landed_breakdown:[],
        items:[
          {movement_id:'m1',product_name:'A',product_sku:'A',qty:1,base_unit_cost:20,base_total:20,discount_share:0,landed_share:0,net_unit_cost:20,net_total:20,note:'GR|GR-TEST|COST_INCLUDED'},
          {movement_id:'m2',product_name:'B',product_sku:'B',qty:2,base_unit_cost:35,base_total:70,discount_share:0,landed_share:0,net_unit_cost:35,net_total:70,note:'GR|GR-TEST|COST_INCLUDED'}
        ]
      }];
      window.currentShop = {id:'shop-1'};
      window.fmt = n => String(n);
      window.fmtB = n => '฿'+Number(n).toFixed(2);
      window.escapeHTML = n => String(n ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
      window.toast = () => {};
      window.confirm = () => true;
      Object.defineProperty(window,'crypto',{value:{randomUUID:()=>'00000000-0000-4000-8000-000000000001'}});
      window.loadStockHistory = async () => {};
      window.sb = {rpc: async (name,payload) => {window._rpc = {name,payload};return {error:null};}};
    });
    await page.addScriptTag({content:source});
    await page.evaluate(() => openGRDocumentDetail(encodeURIComponent('GR-TEST')));
    assert.equal(await page.locator('#gr-lc-save').count(),1);
    await page.locator('#gr-lc-amount').fill('18');
    await page.locator('#gr-lc-reason').fill('ค่าขนส่งใบแจ้งหนี้ 123');
    assert.match(await page.locator('#gr-lc-preview').textContent(),/฿108\.00/);
    await page.evaluate(() => saveGRLandedAdjustment(encodeURIComponent('GR-TEST')));
    const rpc = await page.evaluate(() => window._rpc);
    assert.equal(rpc.name,'add_gr_landed_cost');
    assert.equal(rpc.payload.p_gr_no,'GR-TEST');
    assert.equal(rpc.payload.p_amount,18);
    assert.equal(rpc.payload.p_expected_total,90);
    assert.equal(rpc.payload.p_request_id,'00000000-0000-4000-8000-000000000001');
    console.log('GR landed-cost UI and RPC payload: OK');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
