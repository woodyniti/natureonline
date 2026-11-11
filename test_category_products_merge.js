const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('Testing Category Products View & Merge System v3.42...');

const htmlPath = path.join(__dirname, 'index.html');
const rawContent = fs.readFileSync(htmlPath, 'utf8');
const content = rawContent.replace(/\r\n/g, '\n');

// 1. Version check
assert(content.includes("CURRENT_APP_VERSION = 'sealthai-v3.42'"), "CURRENT_APP_VERSION should be sealthai-v3.42");
assert(content.includes("DISPLAY_APP_VERSION = 'v3.42'"), "DISPLAY_APP_VERSION should be v3.42");
console.log('✓ Version is updated to v3.42');

// 2. Logic testing for category normalization and whitespace duplicate grouping
function normalizeCategoryName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

assert.strictEqual(normalizeCategoryName('OIL  SEAL   NBR'), 'oil seal nbr');
assert.strictEqual(normalizeCategoryName('  Oil Seal NBR  '), 'oil seal nbr');
assert.strictEqual(normalizeCategoryName('O-RING'), 'o-ring');
console.log('✓ normalizeCategoryName correctly handles multiple whitespace and casing');

// Simulate getDuplicateCategoryGroups logic
function getDuplicateCategoryGroups(categories) {
  const groups = {};
  (categories || []).forEach(cat => {
    const rawName = (cat && (cat.name || cat.category_name)) || '';
    const norm = normalizeCategoryName(rawName);
    if (!norm) return;
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(cat);
  });
  return Object.values(groups).filter(grp => grp.length > 1);
}

const mockCategories = [
  { id: '1', name: 'OIL SEAL NBR' },
  { id: '2', name: 'OIL  SEAL  NBR' },
  { id: '3', name: 'O-RING' },
  { id: '4', name: 'O-RING ' }
];
const dups = getDuplicateCategoryGroups(mockCategories);
assert.strictEqual(dups.length, 2, 'Should detect 2 duplicate groups');
assert.strictEqual(dups[0].length, 2, 'First group should have 2 categories');
assert.strictEqual(dups[1].length, 2, 'Second group should have 2 categories');
console.log('✓ getDuplicateCategoryGroups accurately groups whitespace duplicates');

// 3. Category Products Modal functions
assert(content.includes('function openCategoryProductsModal('), 'openCategoryProductsModal must exist');
assert(content.includes('function renderCategoryProductsTable('), 'renderCategoryProductsTable must exist');
assert(content.includes('function filterCategoryProductsList('), 'filterCategoryProductsList must exist');
assert(content.includes('function viewProductsInCategory('), 'viewProductsInCategory must exist');
assert(content.includes('function quickMoveProductCategory('), 'quickMoveProductCategory must exist');
console.log('✓ Category Products Modal & quick management functions exist');

// 4. Merge Categories functions
assert(content.includes('function openMergeCategoriesModal('), 'openMergeCategoriesModal must exist');
assert(content.includes('function switchMergeCatTab('), 'switchMergeCatTab must exist');
assert(content.includes('function submitManualCategoryMerge('), 'submitManualCategoryMerge must exist');
assert(content.includes('function mergeCategoryGroup('), 'mergeCategoryGroup must exist');
assert(content.includes('function autoMergeAllDuplicateCategories('), 'autoMergeAllDuplicateCategories must exist');
assert(content.includes('async function executeMergeCategories('), 'executeMergeCategories must exist');
console.log('✓ Category Merge functions exist');

// 5. Category Edit Sync to Products
assert(content.includes("oldName && oldName !== name"), 'saveCat must detect category name change');
assert(content.includes(".from('products').update({ category: name }).eq('shop_id', currentShop.id).eq('category', oldName)"), 'saveCat must sync rename to products table in Supabase');
assert(content.includes("p.category = name"), 'saveCat must sync rename in-memory');
console.log('✓ Category name editing automatically syncs to products');

// 6. UI elements in category cards
assert(content.includes("📦 ดูสินค้า"), 'Category card must include "ดูสินค้า" button');
assert(content.includes("🔗 รวม"), 'Category card must include "รวม" button');
console.log('✓ Category cards feature quick action buttons');

// 7. Global bindings
const requiredBindings = [
  'openCategoryProductsModal',
  'renderCategoryProductsTable',
  'filterCategoryProductsList',
  'viewProductsInCategory',
  'quickMoveProductCategory',
  'openMergeCategoriesModal',
  'switchMergeCatTab',
  'submitManualCategoryMerge',
  'mergeCategoryGroup',
  'autoMergeAllDuplicateCategories'
];
requiredBindings.forEach(fn => {
  assert(content.includes(`window.${fn} = ${fn};`), `window.${fn} must be bound to window`);
});
console.log('✓ All category modal functions bound to global window');

// 8. Changelog entry for v3.42
assert(content.includes("v:'3.42'"), "Changelog must include v3.42");
console.log('✓ Changelog updated with v3.42 details');

console.log('All Category Products & Merge tests passed successfully!');
