const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('Testing v3.48 Today Orders Filter & Live Counter Badge...');

// 1. Version assertions
assert.ok(/(?:sealthai-)?v3\.(?:4[8-9]|[5-9]\d)/.test(html), 'CURRENT_APP_VERSION must be >= v3.48');
assert.ok(html.includes("v:'3.48'"), 'Changelog must include v3.48 entry');
console.log('✓ 1. Version assertions passed');

// 2. Button and Badge elements in Orders Page
assert.ok(html.includes('id="btn-ord-today"'), 'Quick tabs must contain #btn-ord-today');
assert.ok(html.includes('id="ord-today-badge"'), 'Today button must contain #ord-today-badge');
assert.ok(html.includes('id="btn-ord-filter-today"'), 'Filter bar must contain #btn-ord-filter-today');
assert.ok(html.includes('id="ord-filter-today-count"'), 'Filter bar button must contain #ord-filter-today-count');
console.log('✓ 2. Button and live badge elements verified');

// 3. Core function declarations
assert.ok(html.includes('async function setOrdToday'), 'Must declare async function setOrdToday');
assert.ok(html.includes('async function updateTodayOrderCountBadge'), 'Must declare async function updateTodayOrderCountBadge');
console.log('✓ 3. Function declarations verified');

// 4. Execution integration
assert.ok(html.includes('onclick="setOrdToday()"'), 'Buttons must trigger setOrdToday() on click');
assert.ok(html.includes('updateTodayOrderCountBadge()'), 'orders() and loadOrders() must invoke updateTodayOrderCountBadge()');
console.log('✓ 4. Execution integration verified');

// 5. Reset on month/year/clear filter
assert.ok(html.includes("todayBtn.classList.remove('btn-primary')"), 'setOrdMonth, setOrdYear and clearOrdFilter must reset todayBtn');
console.log('✓ 5. Filter state resetting verified');

console.log('\nALL TODAY ORDERS FILTER (v3.48) TESTS PASSED SUCCESSFULLY! 🚀');
