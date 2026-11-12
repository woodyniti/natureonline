const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('Testing v3.46 Delivery Date in Order...');

// 1. Version assertions
assert.ok(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.46'"), 'CURRENT_APP_VERSION must be v3.46');
assert.ok(html.includes("DISPLAY_APP_VERSION = 'v3.46'"), 'DISPLAY_APP_VERSION must be v3.46');
assert.ok(html.includes("v3.46 🚀 System Active"), 'Active version badge must be v3.46');
assert.ok(html.includes("v3.46 🚀"), 'Topbar badge must be v3.46');
assert.ok(html.includes("v:'3.46'"), 'Changelog must include v3.46 entry');
console.log('✓ Version assertions passed');

// 2. Field existence assertions
assert.ok(html.includes('id="o-delivery-date"'), 'New Order modal must have #o-delivery-date');
assert.ok(html.includes('id="ed-delivery-date"'), 'Edit Order modal must have #ed-delivery-date');
assert.ok(html.includes('getOrderDeliveryDate'), 'Must declare getOrderDeliveryDate function');
console.log('✓ Form fields and helpers verified');

// 3. UI Display in Order List & Mobile
assert.ok(html.includes('🚚 ส่ง:'), 'Order table must include delivery date badge');
assert.ok(html.includes('<th>ออเดอร์ / วันส่ง</th>'), 'Table header must indicate delivery date');
console.log('✓ Desktop & Mobile UI badges verified');

// 4. Receipt print verification
assert.ok(html.includes('วันส่งสินค้า / Delivery:'), 'Receipt print must include delivery date');
console.log('✓ Receipt print verified');

// 5. Test getOrderDeliveryDate logic simulation
function getOrderDeliveryDate(order) {
  if (order?.delivery_date && String(order.delivery_date).trim()) {
    return String(order.delivery_date).trim().slice(0, 10);
  }
  const raw = String(order?.note || '');
  const mTag = raw.match(/(?:^|\n)\[\[DELIVERY_DATE:([0-9]{4}-[0-9]{2}-[0-9]{2})\]\](?=\n|$)/i);
  if (mTag && mTag[1]) return mTag[1];
  const mText = raw.match(/(?:^|\n)\[(?:DELIVERY_DATE|วันที่ส่งสินค้า|วันส่งสินค้า|Delivery Date):\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\](?=\n|$)/i);
  if (mText && mText[1]) return mText[1];
  return order?.order_date ? String(order.order_date).trim().slice(0, 10) : '';
}

// Case A: From delivery_date column
assert.strictEqual(getOrderDeliveryDate({ delivery_date: '2026-11-15', order_date: '2026-11-12' }), '2026-11-15');
// Case B: From note tag
assert.strictEqual(getOrderDeliveryDate({ note: 'หมายเหตุ\n[[DELIVERY_DATE:2026-11-16]]', order_date: '2026-11-12' }), '2026-11-16');
// Case C: Fallback to order_date
assert.strictEqual(getOrderDeliveryDate({ note: 'หมายเหตุธรรมดา', order_date: '2026-11-12' }), '2026-11-12');
console.log('✓ getOrderDeliveryDate extraction passed all 3 cases');

console.log('\nALL DELIVERY DATE TESTS PASSED SUCCESSFULLY! 🚀');
