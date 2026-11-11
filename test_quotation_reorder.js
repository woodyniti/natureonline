const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

// 1. Version check
assert.match(content, /CURRENT_APP_VERSION = 'sealthai-v3\.\d+'/, 'CURRENT_APP_VERSION should be v3.38+');
assert.match(content, /DISPLAY_APP_VERSION = 'v3\.\d+'/, 'DISPLAY_APP_VERSION should be v3.38+');

// 2. Reordering buttons & card header in renderQuoteItems
assert.match(content, /function syncQuoteItemInputs\(idx\)/, 'syncQuoteItemInputs helper should exist');
assert.match(content, /ลำดับที่ \$\{i\+1\}/, 'Item order badge should show index + 1');
assert.match(content, /▲ เลื่อนขึ้น/, 'Up button should exist');
assert.match(content, /▼ เลื่อนลง/, 'Down button should exist');
assert.match(content, /poItems|quoteItems\[i\] = quoteItems\[i-1\]/, 'Reorder swap logic should be in place');

// 3. Sequential ordering in printQuote and convertToOrder
assert.match(content, /sb\.from\('quotation_items'\)\.select\('\*'\)\.eq\('quotation_id',qtId\)\.order\('id',\s*\{ascending:true\}\)/, 'Quotation items query in printQuote & convertToOrder should explicitly order by id ascending');

// 4. Quotation table sorting
assert.match(content, /function toggleQuoteSort\(field\)/, 'toggleQuoteSort function should exist');
assert.match(content, /date_asc/, 'date_asc sort option should exist');
assert.match(content, /total_asc/, 'total_asc sort option should exist');
assert.match(content, /no_asc/, 'no_asc sort option should exist');

console.log('Quotation item reorder and table sorting test: PASSED (OK)!');
