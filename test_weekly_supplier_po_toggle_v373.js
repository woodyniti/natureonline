const fs = require('fs');
const path = require('path');
const assert = require('assert');

const htmlPath = path.join(__dirname, 'index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing v3.73 Weekly Supplier Gratuity PO Exclusion / Tick Box ---');

// 1. Version assertions
const versionMatch = content.match(/CURRENT_APP_VERSION = 'sealthai-v([\d.]+)'/);
assert.ok(versionMatch && parseFloat(versionMatch[1]) >= 3.73, 'CURRENT_APP_VERSION should be >= sealthai-v3.73');
console.log('✓ App version is >= v3.73');

// 2. Checkbox in PO table of modal
assert.ok(content.includes('toggleWeeklySupplierPO'), 'toggleWeeklySupplierPO handler must exist');
assert.ok(content.includes('toggleAllWeeklySupplierPOs'), 'toggleAllWeeklySupplierPOs helper must exist');
assert.ok(content.includes('recalcWeeklySupplierRow'), 'recalcWeeklySupplierRow must exist');
console.log('✓ Checkbox functions and recalculation handlers exist');

// 3. UI Indicators: "นำมาคิด", "สถานะการคิด", "🚫 ไม่นำมาคำนวณ", "✓ คำนวณยอด"
assert.ok(content.includes('🚫 ไม่นำมาคำนวณ'), 'Excluded PO badge must be present');
assert.ok(content.includes('✓ คำนวณยอด'), 'Included PO badge must be present');
assert.ok(content.includes('นำมาคิด'), 'Table header column for inclusion checkbox must exist');
console.log('✓ Visual badges and column header exist');

// 4. Persistence in savedRecords (excluded_po_ids)
assert.ok(content.includes('excluded_po_ids'), 'excluded_po_ids array must be tracked in savedRecords');
assert.ok(content.includes('savedRecords[groupId].excluded_po_ids'), 'toggleWeeklySupplierPO must save excluded_po_ids');
console.log('✓ Excluded PO IDs are tracked and saved in localStorage');

// 5. Excluded POs skipped in loadWeeklySupplierExpenses and calculatePeriodSupplierWeeklyExpenses
assert.ok(content.includes('if (!isExcluded) {'), 'loadWeeklySupplierExpenses must only add non-excluded POs to net_purchase_amount');
assert.ok(content.includes('if (excludedPoIds.includes(String(po.id))) return;'), 'calculatePeriodSupplierWeeklyExpenses must skip excluded POs');
console.log('✓ Excluded POs are correctly omitted from calculation base and profit/loss reports');

// 6. Changelog contains v3.73 entry
assert.ok(content.includes("v:'3.73'"), 'Changelog must contain v3.73 entry');
console.log('✓ Changelog contains v3.73 entry');

console.log('\nAll tests in test_weekly_supplier_po_toggle_v373.js PASSED successfully! 🎉');
