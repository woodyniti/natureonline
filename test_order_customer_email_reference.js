const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('async function viewOrder(orderId)');
const end = html.indexOf('\nasync function ', start + 1);
assert.ok(start >= 0 && end > start, 'order detail renderer exists');
const renderer = html.slice(start, end);
const customerLookup = renderer.match(/const orderCustomer = ([^;]+);/);
const emailLookup = renderer.match(/const orderCustomerEmail = ([^;]+);/);
assert.ok(customerLookup && emailLookup, 'order detail resolves the customer and email before rendering');
assert.ok(renderer.indexOf('await loadOrderCustomerList()') < renderer.indexOf('const orderCustomer ='), 'customer list loads before lookup');
assert.doesNotMatch(renderer, /(?<!_)\ballCustomers\b/, 'order detail never references the undefined allCustomers variable');
assert.match(renderer, /orderCustomerEmail \? `<span/, 'customer email badge uses the resolved value');
assert.match(renderer, /id="ed-email" value="\$\{escapeHTML\(orderCustomerEmail\)\}"/, 'editable email field uses the same escaped value');

const lookup = new Function('order', '_orderCustomerList', 'getOrderCustomerEmail',
  `const orderCustomer = ${customerLookup[1]}; return ${emailLookup[1]};`);
const readEmail = (order, customer) => order.customer_email || customer?.email || '';
const customers = [{ id: 'customer-1', customer_email: 'buyer@example.test' }];
assert.equal(lookup({ customer_id: 'customer-1' }, customers, readEmail), 'buyer@example.test');
assert.equal(lookup({ customer_id: 'customer-1', customer_email: 'order@example.test' }, customers, readEmail), 'order@example.test');
assert.equal(lookup({ customer_id: 'missing' }, customers, readEmail), '');
console.log('Order detail customer email lookups: OK');
