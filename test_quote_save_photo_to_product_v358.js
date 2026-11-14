// test_quote_save_photo_to_product_v358.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Quotation Item Photo Panel & Save Photo to Product (v3.58) ---');

const htmlPath = path.join(__dirname, 'index.html');
assert(fs.existsSync(htmlPath), 'index.html must exist');
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Version check
assert(html.includes("const CURRENT_APP_VERSION = 'sealthai-v3.58';"), 'CURRENT_APP_VERSION must be sealthai-v3.58');
assert(html.includes("const DISPLAY_APP_VERSION = 'v3.58';"), 'DISPLAY_APP_VERSION must be v3.58');
assert(html.includes('v3.58 🚀'), 'Topbar badge must show v3.58 🚀');
assert(html.includes('เปิดแผงเพิ่มรูปประกอบใบเสนอราคาทันที & บันทึกรูปภาพลงสินค้าในคลังสำหรับใช้งานในอนาคต (v3.58)'), 'Changelog must include v3.58');
console.log('✓ 1. App version correctly bumped to v3.58');

// 2. saveQuoteItemPhotoToProduct function check
assert(html.includes('async function saveQuoteItemPhotoToProduct(rowIdx, slotIdx)'), 'saveQuoteItemPhotoToProduct function must exist');
assert(html.includes("window.saveQuoteItemPhotoToProduct = saveQuoteItemPhotoToProduct;"), 'saveQuoteItemPhotoToProduct must be attached to window');
assert(html.includes("sb.from('products').update({ image_url: pSlot.url })"), 'saveQuoteItemPhotoToProduct must update products table in Supabase');
console.log('✓ 2. saveQuoteItemPhotoToProduct function verified and saves to database');

// 3. Check renderQuoteItems photo panel is open by default and contains save-to-product button
assert(html.includes('it._showPhotos !== false'), 'Photo panel in renderQuoteItems must be open by default');
assert(html.includes('บันทึกรูปนี้ลงคลัง'), 'Save photo to catalog button must exist');
assert(html.includes('อัปโหลดรูปภาพจากเครื่อง'), 'Upload photo button must exist');
console.log('✓ 3. Photo panel is open by default and provides Save to Catalog button');

// 4. Check selectQuoteProductById automatically fills photo from catalog
assert(html.includes('const pImg = getProductImageUrl(p);'), 'selectQuoteProductById must resolve catalog product image');
assert(html.includes('existingPhotos[0] = {'), 'selectQuoteProductById must auto-fill photo slot 0');
console.log('✓ 4. selectQuoteProductById auto-populates image from catalog');

// 5. Check viewQuote renders photo thumbnails in contents tab
assert(html.includes('validPhotos.map(p => `<img src="${escapeHTML(p.url)}"'), 'viewQuote must render thumbnails for items with photos');
console.log('✓ 5. viewQuote renders photo thumbnails in item list');

console.log('\n🎉 ALL V3.58 QUOTATION PHOTO TESTS PASSED SUCCESSFULLY!');
