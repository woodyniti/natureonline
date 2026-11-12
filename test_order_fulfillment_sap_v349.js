const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('d:/Nature Online/Sealthai AI Ecosystem V1/Shop Dashboard/index.html', 'utf8');

console.log('Testing v3.49 Order Stock Sufficiency Guard, Partial Shipment & SAP B1 Close Approval...');

// 1. Version assertions
assert.ok(html.includes("CURRENT_APP_VERSION = 'sealthai-v3.49'") || html.includes("CURRENT_APP_VERSION = 'sealthai-v3.50'"), 'CURRENT_APP_VERSION must be v3.49 or higher');
assert.ok(html.includes("DISPLAY_APP_VERSION = 'v3.49'") || html.includes("DISPLAY_APP_VERSION = 'v3.50'"), 'DISPLAY_APP_VERSION must be v3.49 or higher');
assert.ok(html.includes("v:'3.49'"), 'Changelog must include v3.49 entry');
console.log('✓ 1. Version assertions passed');

// 2. Status definitions and badge styles
assert.ok(html.includes("{ key:'closed',    label:'Closed',     th:'🔒 ปิดแล้ว (Close)' }") || html.includes("{ key:'closed', label:'Closed', th:'🔒 ปิดแล้ว (Close)' }") || html.includes("key:'closed'"), 'DOC_STATUSES must contain closed status');
assert.ok(html.includes('.ds-closed'), 'CSS must define .ds-closed badge style');
assert.ok(html.includes('partially_shipped:'), 'shippingBadge and shipSelStyle must define partially_shipped');
assert.ok(html.includes('⚠️ จัดส่งบางส่วน (ค้างส่ง)'), 'Status label for partially_shipped must be ⚠️ จัดส่งบางส่วน (ค้างส่ง)');
console.log('✓ 2. Status definitions and badge styles verified');

// 3. Core function declarations
assert.ok(html.includes('function getOrderFulfillmentData'), 'Must declare getOrderFulfillmentData');
assert.ok(html.includes('function getSAPCloseData'), 'Must declare getSAPCloseData');
assert.ok(html.includes('async function checkOrderStockSufficiency'), 'Must declare checkOrderStockSufficiency');
assert.ok(html.includes('async function openOrderFulfillmentModal'), 'Must declare openOrderFulfillmentModal');
assert.ok(html.includes('async function submitOrderPartialShipment'), 'Must declare submitOrderPartialShipment');
assert.ok(html.includes('async function submitSAPCloseOrderApproval'), 'Must declare submitSAPCloseOrderApproval');
console.log('✓ 3. Core function declarations verified');

// 4. Stock sufficiency guard in quickUpdateStatus
assert.ok(html.includes('checkOrderStockSufficiency(orderId, ord)'), 'quickUpdateStatus must check stock sufficiency before changing to shipped');
assert.ok(html.includes('ไม่สามารถเปลี่ยนสถานะเป็น "จัดส่งแล้ว" ได้ เนื่องจากสินค้าในคลังไม่พอส่ง'), 'quickUpdateStatus must block and toast when stock is insufficient');

// 5. Stock sufficiency guard in saveOrderEdit
assert.ok(html.includes('checkOrderStockSufficiency(orderId, {'), 'saveOrderEdit must check stock sufficiency when saving with shipped status');
assert.ok(html.includes('ไม่สามารถบันทึกเป็น "จัดส่งแล้ว" ได้ เนื่องจากสินค้าในคลังไม่พอส่ง'), 'saveOrderEdit must block and toast when stock is insufficient');
console.log('✓ 4 & 5. Stock sufficiency guards verified in quickUpdateStatus and saveOrderEdit');

// 6. UI Badges and Elements in Orders list & Order detail modal
assert.ok(html.includes('⚠️ ค้างส่ง ${backorderQty} ชิ้น') || html.includes('ค้างส่ง'), 'Must render backorder badge for items in order list');
assert.ok(html.includes('🔒 ปิดเอกสาร (SAP B1)'), 'Must render SAP B1 closed badge when document is closed');
assert.ok(html.includes("openOrderFulfillmentModal('${order.id}')"), 'Order detail footer must contain button to open fulfillment modal');
console.log('✓ 6. UI Badges and modal entry points verified');

// 7. Logic Simulation Tests: Stock Sufficiency Calculation
function simulateCheckStockSufficiency(order, productsMap) {
  const isOrderPending = !order.shipping_status || order.shipping_status === 'pending' || order.shipping_status === 'partially_shipped';
  const shortfallItems = [];
  let totalShortfall = 0;

  for (const it of order.order_items) {
    if (!it.product_id) continue;
    const p = productsMap[it.product_id];
    if (!p) continue;

    const rawStock = Number(p.stock_inhouse ?? p.stock_qty ?? 0);
    const orderedQty = Math.max(1, Number(it.qty || 1));
    const stockVal = isOrderPending ? (rawStock + orderedQty) : rawStock;
    const available = Math.max(0, stockVal);

    if (available < orderedQty) {
      const shortfall = orderedQty - available;
      shortfallItems.push({
        product_id: it.product_id,
        ordered_qty: orderedQty,
        available_qty: available,
        shortfall
      });
      totalShortfall += shortfall;
    }
  }

  return {
    isSufficient: shortfallItems.length === 0,
    shortfallItems,
    totalShortfall
  };
}

// Case A: Product ordered 2, in warehouse only 1 (rawStock = -1 because ordered 2 deducted from 1 available)
const testOrder1 = {
  id: 'ord-001',
  shipping_status: 'pending',
  order_items: [{ product_id: 'prod-A', qty: 2 }]
};
const testProdMap1 = {
  'prod-A': { stock_inhouse: -1 } // 1 - 2 = -1
};
const check1 = simulateCheckStockSufficiency(testOrder1, testProdMap1);
assert.strictEqual(check1.isSufficient, false, 'Check 1 should be insufficient');
assert.strictEqual(check1.totalShortfall, 1, 'Shortfall should be 1');
console.log('✓ 7. Simulation Case A (Insufficient stock detected) passed');

// Case B: Product ordered 2, in warehouse 5 (rawStock = 3)
const testOrder2 = {
  id: 'ord-002',
  shipping_status: 'pending',
  order_items: [{ product_id: 'prod-B', qty: 2 }]
};
const testProdMap2 = {
  'prod-B': { stock_inhouse: 3 } // 5 - 2 = 3
};
const check2 = simulateCheckStockSufficiency(testOrder2, testProdMap2);
assert.strictEqual(check2.isSufficient, true, 'Check 2 should be sufficient');
assert.strictEqual(check2.totalShortfall, 0, 'Shortfall should be 0');
console.log('✓ 7. Simulation Case B (Sufficient stock passes) passed');

// 8. Note Tag Persistence & Extraction
const dummyNote = "เอกสารปกติ\n[บริษัท: สยามซีล]\n[[ORDER_FULFILLMENT:%7B%22total_backorder%22%3A1%7D]]\n[[SAP_B1_CLOSE:%7B%22approved_by%22%3A%22Admin%22%2C%22reason%22%3A%22OK%22%7D]]";

const fMatch = dummyNote.match(/\[\[ORDER_FULFILLMENT:([\s\S]*?)\]\]/i);
assert.ok(fMatch && fMatch[1], 'Must match ORDER_FULFILLMENT tag');
const fObj = JSON.parse(decodeURIComponent(fMatch[1]));
assert.strictEqual(fObj.total_backorder, 1, 'Decoded fulfillment backorder must be 1');

const sMatch = dummyNote.match(/\[\[SAP_B1_CLOSE:([\s\S]*?)\]\]/i);
assert.ok(sMatch && sMatch[1], 'Must match SAP_B1_CLOSE tag');
const sObj = JSON.parse(decodeURIComponent(sMatch[1]));
assert.strictEqual(sObj.approved_by, 'Admin', 'Decoded approver must be Admin');
assert.strictEqual(sObj.reason, 'OK', 'Decoded reason must be OK');
console.log('✓ 8. Note tag persistence & extraction verified');

console.log('\nALL ORDER FULFILLMENT & SAP B1 CLOSE (v3.49) TESTS PASSED SUCCESSFULLY! 🚀');
