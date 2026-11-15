const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.70 Product Sticker 10x15 cm (4 per sheet) ---');

// 1. Version assertions
assert.ok(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.70'"), 'CURRENT_APP_VERSION should be sealthai-v3.70');
assert.ok(content.includes("DISPLAY_APP_VERSION = 'v3.70'"), 'DISPLAY_APP_VERSION should be v3.70');
assert.ok(content.includes('v3.70 🚀'), 'Topbar badge should display v3.70 🚀');
console.log('✓ App version is v3.70');

// 2. Size option 10x15cm in modal
assert.ok(content.includes('value="10x15cm"'), 'Modal must have 10x15cm option');
assert.ok(content.includes('10 &times; 15 cm (4 รายการ/หน้า)'), 'Modal option text must state 10 x 15 cm (4 รายการ/หน้า)');
console.log('✓ Modal contains 10x15 cm (4 items/sheet) option');

// 3. No PART NO column
assert.ok(!content.includes("<th>PART NO.</th>"), 'Table must not have PART NO column');
assert.ok(content.includes("<th class=\"th-qty\">QTY</th>"), 'Table must have QTY column');
assert.ok(content.includes("<th class=\"th-desc\">DESCRIPTION</th>"), 'Table must have DESCRIPTION column');
console.log('✓ Sticker table has NO PART NO column and has QTY + DESCRIPTION');

// 4. Header with SEALTHAI.COM on top right
assert.ok(content.includes('SEALTHAI.COM'), 'Sticker must have SEALTHAI.COM on top right');
assert.ok(content.includes('stk-brand-text'), 'Sticker has brand text class');
console.log('✓ Sticker header has SEALTHAI.COM on top right');

// 5. Footer with websites
assert.ok(content.includes('www.sealthai.com | www.oilsealthai.com | Line : @sealthai'), 'Sticker must have website footer');
console.log('✓ Sticker footer has www.sealthai.com | www.oilsealthai.com | Line : @sealthai');

// 6. 10x15 cm 4 items per sheet chunking
assert.ok(content.includes('chunkSize = 4'), 'Must chunk into 4 stickers per 10x15 sheet');
assert.ok(content.includes('sticker-sheet-10x15'), 'Must have sticker-sheet-10x15 class');
assert.ok(content.includes('100mm 150mm'), 'Page size must be 100mm 150mm');
console.log('✓ 10x15 cm prints 4 stickers per sheet with 100mm x 150mm page size');

// 7. Changelog contains v3.70
assert.ok(content.includes("{ v:'3.70', date:'2026-11-15', badge:'Latest'"), 'Changelog must include v3.70 as Latest');
console.log('✓ Changelog contains v3.70 entry');

console.log('\nAll tests in test_sticker_10x15_v370.js PASSED successfully!');
