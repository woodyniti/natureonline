const assert = require('node:assert/strict');
const fs = require('node:fs');

const html=fs.readFileSync('index.html','utf8');
const sql=fs.readFileSync('supabase_orders_customer_po_v311.sql','utf8');
assert.match(html,/id="o-customer-po"/);
assert.match(html,/id="ed-customer-po"/);
assert.match(html,/customer_po_no: \(document\.getElementById\('o-customer-po'\)/);
assert.match(html,/customer_po_no: \(document\.getElementById\('ed-customer-po'\)/);
const ref=html.indexOf('if (order.customer_social) {',html.indexOf('const billParts = []'));
const customerPo=html.indexOf('if (order.customer_po_no) {',ref);
const tracking=html.indexOf('if (order.tracking_no) {',customerPo);
assert.ok(ref>=0 && customerPo>ref && tracking>customerPo,'customer PO prints after reference and before tracking');
assert.match(html,/escapeHTML\(order\.customer_po_no\)/);
assert.match(sql,/ALTER TABLE public\.orders[\s\S]*ADD COLUMN IF NOT EXISTS customer_po_no text/);
console.log('Customer PO on orders and cash-sale printout: OK');
