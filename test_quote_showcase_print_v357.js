// test_quote_showcase_print_v357.js
// Verification of Quotation Showcase Print Form & Item Photos attachment in v3.57

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing Quotation Showcase Print & Item Photos (v3.57) ---');

// 1. Version assertions (v3.57 or newer)
assert(html.includes("const CURRENT_APP_VERSION = 'sealthai-v3.57';") || html.includes("const CURRENT_APP_VERSION = 'sealthai-v3.58';"), 'CURRENT_APP_VERSION must be at least sealthai-v3.57');
assert(html.includes("const DISPLAY_APP_VERSION = 'v3.57';") || html.includes("const DISPLAY_APP_VERSION = 'v3.58';"), 'DISPLAY_APP_VERSION must be at least v3.57');
console.log('✓ 1. App version verified');

// 2. Test getQuoteMeta parses item_photos
const startIdx = html.indexOf('function getQuoteMeta(qt) {');
const endIdx = html.indexOf('async function openNewQuote()');
assert(startIdx > 0 && endIdx > startIdx, 'Could not locate getQuoteMeta code block');
const metaCode = html.substring(startIdx, endIdx);
const metaFunc = new Function('qt', metaCode + '; return getQuoteMeta(qt);');

const testQtWithPhotos = {
  note: 'ทดสอบเสนอราคา\n<!--QT_META:{"channel":"LINE","item_photos":{"0":[{"url":"https://example.com/oilseal.jpg","title":"มุมมองด้านหน้า","desc":"NBR ขอบเหล็ก"}]}}-->'
};
const parsedMeta = metaFunc(testQtWithPhotos);
console.log('DEBUG parsedMeta:', JSON.stringify(parsedMeta, null, 2));
assert(parsedMeta.item_photos, 'item_photos must be parsed from QT_META');
assert(parsedMeta.item_photos['0'], 'item 0 photos must exist');
assert.strictEqual(parsedMeta.item_photos['0'][0].url, 'https://example.com/oilseal.jpg');
assert.strictEqual(parsedMeta.item_photos['0'][0].title, 'มุมมองด้านหน้า');
console.log('✓ 2. getQuoteMeta properly extracts item_photos');

// 3. Test openQuotePrintOptions supports layout selection
assert(html.includes('quote-layout-type'), 'openQuotePrintOptions must include quote-layout-type radio options');
assert(html.includes('แบบมีรูปประกอบ') || html.includes('แบบมีภาพประกอบสินค้า'), 'openQuotePrintOptions must have showcase option');
console.log('✓ 3. openQuotePrintOptions includes print layout selector');

// 4. Test printQuote accepts layoutType and renders showcase when requested
assert(html.includes("async function printQuote("), 'printQuote function must exist');
assert(html.includes("layoutType"), 'printQuote must accept layoutType parameter');
assert(html.includes("gallery-row") || html.includes("photo-card"), 'printQuote must include showcase gallery styles');
console.log('✓ 4. printQuote supports showcase layout with gallery rows');

// 5. Test item photo attachment UI in quote edit modal
assert(html.includes('ภาพประกอบสินค้า') || html.includes('แนบรูปประกอบ'), 'Quotation items must support photo attachments');
console.log('✓ 5. Quotation modal supports photo attachments');

console.log('\nALL QUOTATION SHOWCASE PRINT TESTS PASSED! 🎉');
