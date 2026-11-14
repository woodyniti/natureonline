const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.64 A6 Shipping Label Margin & Layout ---');

// 1. Version assertions
assert.ok(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.64'"), 'CURRENT_APP_VERSION should be sealthai-v3.64');
assert.ok(content.includes("DISPLAY_APP_VERSION = 'v3.64'"), 'DISPLAY_APP_VERSION should be v3.64');
assert.ok(content.includes('v3.64 🚀'), 'Topbar badge should display v3.64 🚀');
console.log('✓ App version is v3.64');

// 2. A6 dimension and margin in printShippingLabel
assert.ok(content.includes("if (size === 'A6') { Wstr = '100mm'; Hstr = '150mm'; }"), 'A6 dimensions should be 100mm x 150mm');
assert.ok(content.includes("const isA6 = size === 'A6';"), 'isA6 should be defined');
assert.ok(content.includes("padding:' + (isA6 ? '4mm 0.5cm' : '0.15in')"), 'A6 screen layout should have 4mm 0.5cm padding (0.5 cm left/right margin)');
assert.ok(content.includes("padding:4mm 0.5cm !important;"), 'A6 print media should have padding:4mm 0.5cm !important (0.5 cm left/right margin)');
assert.ok(content.includes("@page { size:' + (isA4 ? 'A4 portrait; margin:15mm;' : (isA6 ? '100mm 150mm; margin:0;'"), 'A6 print page size should be 100mm 150mm');
console.log('✓ printShippingLabel A6 (10x15 cm) has 0.5cm left/right margin in both screen and print media');

// 3. Marketplace label 100x150 padding
assert.ok(content.includes(".label-page { width: 100mm; height: 148mm; padding: 4mm 0.5cm; page-break-after: always; box-sizing: border-box; }"), 'Marketplace 100x150 label should have 0.5cm left/right margin');
console.log('✓ printSelectedMarketplaceLabels 100x150 has 0.5cm left/right margin');

// 4. Changelog contains v3.64
assert.ok(content.includes("{ v:'3.64', date:'2026-11-14', badge:'Latest'"), 'Changelog must include v3.64 as Latest');
console.log('✓ Changelog contains v3.64 entry');

console.log('\nAll tests in test_shipping_label_a6_v364.js PASSED successfully!');
