const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('function orderChannelLogoHTML(ch)');
const end = html.indexOf('function shippingBadge(',start);
assert.ok(start>0 && end>start);
const context = {escapeHTML:value=>String(value)};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);
const testCases = [
  ['Shopee','shopee-summary-logo.png'],
  ['Lazada','lazada-summary-logo.png'],
  ['LINE','line-order-logo.png'],
  ['Thaimart','thaimart-order-logo.png']
];
for (const [channel,file] of testCases) {
  assert.ok(fs.existsSync('assets/'+file));
  assert.match(vm.runInContext(`channelBadge('${channel}',true)`,context),new RegExp(file.replace('.','\\.')));
}
assert.equal(vm.runInContext("orderChannelLogoHTML('Facebook')",context),'');
assert.match(html,/\$\{channelBadge\(o\.channel,true\)\}/);
assert.match(html,/\$\{orderChannelLogoHTML\(o\.channel\)\}/);
console.log('Order channel logos: OK');
