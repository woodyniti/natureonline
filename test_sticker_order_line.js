const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('async function openStickerModal(orderId)');
const end = html.indexOf('\nfunction previewProductImage()', start);
assert.ok(start >= 0 && end > start, 'sticker modal and print functions exist');
const source = html.slice(start, end);

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:375,height:812}});
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.evaluate(() => {
      const items = [
        {id:'line-a',product_name:'O-RING 10x2',qty:25,unit_price:4},
        {id:'line-b',product_name:'O-RING 10x2',qty:25,unit_price:4},
        {id:'line-c',product_name:'O-RING 12x2',qty:10,unit_price:5}
      ];
      const order = {id:'order-1',order_no:'SO-TEST',customer_name:'Test',channel:'Shopee',order_date:'2026-11-23',order_items:items};
      window.sb = {from(table) { return {
        select() {return this;},eq() {return this;},
        async single() {return {data:order,error:null};},
        then(resolve,reject) {return Promise.resolve({data:table==='order_items'?items:order,error:null}).then(resolve,reject);}
      }; }};
      window.toast = () => {};
      window.escapeHTML = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;');
      window.ensureModalCloseButton = () => {};
      window.getNextModalZIndex = () => 3000;
      window.open = () => ({document:{write(value){window._printedStickerHtml=value;},close(){}},print(){}});
    });
    await page.addScriptTag({content:source});
    await page.evaluate(() => openStickerModal('order-1'));
    const modalRows = await page.locator('[id^="stk-chk-"]').count();
    assert.equal(modalRows,3);
    const labels = await page.locator('[id^="stk-chk-"]').evaluateAll(nodes => nodes.map(node => node.parentElement.textContent));
    assert.ok(labels[0].includes('แถว 1'), 'first order line is shown in selector');
    assert.ok(labels[1].includes('แถว 2'), 'duplicate product retains its own order line');
    await page.locator('#stk-chk-0').uncheck();
    await page.locator('#stk-chk-2').uncheck();
    await page.locator('#stk-qty-1').fill('2');
    await page.locator('#stk-show-order').uncheck();
    await page.evaluate(() => printStickers('order-1'));
    const printed = await page.evaluate(() => window._printedStickerHtml);
    assert.ok(printed.includes('แถว 2'), 'selected second line prints its original row number');
    assert.ok(!printed.includes('แถว 1'), 'unselected line is not printed');
    assert.equal((printed.match(/class="stk-line-no">แถว 2/g) || []).length,2,'every label copy includes the line number');
    console.log('Sticker order line selection and print: OK');
    await page.close();
  } finally {await browser.close();}
})().catch(error => {console.error(error.message);process.exitCode=1;});
