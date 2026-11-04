const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const helper = html.match(/function getQuoteBankSettings\(shop = currentShop\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(helper,'quotation bank settings helper exists');
const context = { currentShop:{} };
vm.createContext(context);
vm.runInContext(helper,context);
assert.equal(context.getQuoteBankSettings().accountNumber,'128-8-23520-8');
assert.equal(context.getQuoteBankSettings().name,'ธนาคารกสิกรไทย · KASIKORNBANK');
assert.equal(context.getQuoteBankSettings({quote_bank_name:'Test Bank',quote_bank_account_name:'Test Owner',quote_bank_account_number:'123-456-789'}).accountNumber,'123-456-789');
assert.match(html,/id="s-quote-bank-name"/);
assert.match(html,/id="s-quote-bank-account-name"/);
assert.match(html,/id="s-quote-bank-account-number"/);
assert.match(html,/\.update\(\{ quote_bank_name, quote_bank_account_name, quote_bank_account_number \}\)/);
assert.match(html,/escapeHTML\(bank\.accountNumber\)/);
console.log('Quotation bank settings: OK');
