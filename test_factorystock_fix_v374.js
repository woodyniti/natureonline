const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.74 factoryStockHtml Scope Fix ---');

// 1. Version assertions
assert.ok(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.74'"), 'CURRENT_APP_VERSION should be sealthai-v3.74');
assert.ok(content.includes("DISPLAY_APP_VERSION = 'v3.74'"), 'DISPLAY_APP_VERSION should be v3.74');
assert.ok(content.includes('v3.74 🚀'), 'Topbar badge should display v3.74 🚀');
console.log('✓ App version is v3.74');

// 2. Both desktop and mobile scoping
const count = (content.match(/let quickAddBtn = '';\s*let factoryStockHtml = '';\s*if \(p && p\.id\)/g) || []).length;
assert.strictEqual(count, 2, 'Must have factoryStockHtml declared outside if (p && p.id) in both desktop and mobile views');
console.log('✓ factoryStockHtml is safely scoped in both desktop and mobile tables');

// 3. Changelog contains v3.74
assert.ok(content.includes("v:'3.74'"), 'Changelog must contain v3.74 entry');
console.log('✓ Changelog contains v3.74 entry');

console.log('\nAll tests in test_factorystock_fix_v374.js PASSED successfully! 🎉');
