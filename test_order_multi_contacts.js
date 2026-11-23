const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('function addOrderContactRow(contact = {})');
const end = html.indexOf('\nasync function viewOrder(orderId)',start);
assert.ok(start >= 0 && end > start);
const source = html.slice(start,end);

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="modal-order-detail"><input id="ed-contact" value="Primary"><input id="ed-phone" value="0811111111"><div id="ed-extra-contacts"></div></div>');
    await page.evaluate(() => {
      window.escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
      window.markUnsavedForm = () => {};
      window.toast = () => {};
      window.currentShop = {id:'shop-1'};
      window._editingOrderForGP = {id:'order-1'};
      window.sb = {from() {return {
        update(payload) {window._savedContacts=payload;return this;},
        eq() {return this;},
        select() {return this;},
        async single() {return {data:{id:'order-1'},error:null};}
      };}};
    });
    await page.addScriptTag({content:source});
    await page.evaluate(() => renderOrderExtraContacts([{name:'A "special"',phone:'0822222222',email:'a@example.com'}]));
    assert.equal(await page.locator('.ed-extra-contact-name').inputValue(),'A "special"');
    await page.evaluate(() => addOrderContactRow({name:'B',phone:'0833333333'}));
    assert.equal(await page.locator('.ed-extra-contact-row').count(),2);
    await page.evaluate(() => saveOrderContactsOnly('order-1'));
    const saved = await page.evaluate(() => window._savedContacts);
    assert.equal(saved.customer_contact,'Primary');
    assert.equal(saved.customer_phone,'0811111111');
    assert.deepEqual(saved.order_contacts.map(c => c.name),['A "special"','B']);
    await page.locator('.ed-extra-contact-row button').first().click();
    assert.equal(await page.locator('.ed-extra-contact-row').count(),1);
    console.log('Order multiple contacts: OK');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
