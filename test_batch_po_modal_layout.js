const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

const html = fs.readFileSync('index.html', 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css, 'main application CSS exists');
const rows = Array.from({length:13}, (_, i) => `<tr style="height:52px"><td>${i+1}</td><td>TEST-SKU-${i+1}</td><td>Test item</td></tr>`).join('');
const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
  <div class="modal-overlay open" id="modal-batch-po">
    <div class="modal sap-modal-large" style="width:min(1360px,calc(100vw - 32px));max-width:min(1420px,calc(100vw - 32px));max-height:94vh;padding:0;border:none;background:transparent;box-shadow:none;display:flex;flex-direction:column">
      <div class="sap-window" id="sap-batch-po-window" style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;flex:1;max-height:94vh">
        <div class="sap-header-bar" style="height:70px;flex:none">Purchase Order</div>
        <div class="sap-panel" style="height:100px;flex:none">Vendor / dates</div>
        <div class="sap-tabs" style="height:38px;flex:none">Contents</div>
        <div class="sap-tab-pane active" data-pane="contents" style="padding:10px 14px;overflow-y:auto;flex:1;max-height:calc(92vh - 340px);display:flex;flex-direction:column;box-sizing:border-box">
          <div style="height:40px;flex:none">Toolbar</div>
          <div class="sap-matrix-wrap" style="margin-bottom:0;border-top-left-radius:0;border-top-right-radius:0;flex:1;overflow:auto;max-height:360px">
            <table class="sap-matrix-table" style="min-width:1100px;width:100%"><tbody>${rows}</tbody></table>
          </div>
        </div>
        <div class="sap-footer" style="padding:10px 14px;border-top:1.5px solid #cbd5e1;background:#f8fafc;box-sizing:border-box;min-height:150px"><div>VAT / Save PO</div><div>Total</div></div>
      </div>
    </div>
  </div></body></html>`;

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const width of [1440,768,375]) {
      const page = await browser.newPage({viewport:{width,height:900}});
      await page.setContent(fixture);
      const layout = await page.evaluate(() => {
        const wrap = document.querySelector('#modal-batch-po .sap-matrix-wrap');
        const footer = document.querySelector('#modal-batch-po .sap-footer');
        return {
          overflowY:getComputedStyle(wrap).overflowY,
          overflowX:getComputedStyle(wrap).overflowX,
          modalOverflowY:getComputedStyle(document.querySelector('#modal-batch-po .modal')).overflowY,
          wrapBottom:Math.round(wrap.getBoundingClientRect().bottom),
          footerTop:Math.round(footer.getBoundingClientRect().top),
          footerBottom:Math.round(footer.getBoundingClientRect().bottom),
          tableScrolls:wrap.scrollHeight > wrap.clientHeight,
          footerTopAfterScroll:(()=>{wrap.scrollTop=wrap.scrollHeight;return Math.round(footer.getBoundingClientRect().top)})()
        };
      });
      console.log(`${width}px ${JSON.stringify(layout)}`);
      assert.equal(layout.overflowY, 'auto', `matrix must scroll inside Batch PO at ${width}px`);
      assert.equal(layout.overflowX, 'auto', `wide item table must scroll horizontally at ${width}px`);
      assert.equal(layout.modalOverflowY, 'hidden', `outer Batch PO modal must not scroll independently at ${width}px`);
      assert.ok(layout.wrapBottom <= layout.footerTop + 1, `matrix must end before footer at ${width}px`);
      assert.ok(layout.footerBottom <= 900, `footer must remain visible at ${width}px`);
      assert.ok(layout.tableScrolls, `13 lines must be scrollable at ${width}px`);
      assert.equal(layout.footerTopAfterScroll, layout.footerTop, `scrolling lines must not move the footer at ${width}px`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => {console.error(error.message);process.exitCode=1;});
