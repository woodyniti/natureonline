// Reconcile the order sale (not platform payout) with verified marketplace data.
let _marketplaceAdjustRows = [];
let _marketplaceAdjustBusy = false;

const marketplaceAdjustMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function marketplaceSaleAdjustMatch(order) {
  const channel = String(order?.channel || '').toLowerCase();
  if (channel.includes('shopee')) return { platform:'Shopee', recon:getOrderShopeeReconciliation(order) };
  if (channel.includes('lazada')) return { platform:'Lazada', recon:getOrderLazadaReconciliation(order) };
  return null;
}

function marketplaceSaleAdjustOrderButton(order) {
  const source = marketplaceSaleAdjustMatch(order);
  if (!source || source.recon.status !== 'matched' || isOrderCancelled(order) ||
      Math.abs(Number(order.total_amount || 0) - Number(source.recon.match.sale || 0)) < 0.01) return '';
  return `<div style="margin:8px 0"><button type="button" class="btn btn-secondary btn-sm" data-order-id="${escapeHTML(order.id)}" onclick="openMarketplaceSaleAdjust(this.dataset.orderId)" style="background:#fff7ed;color:#9a3412;border-color:#fdba74">⚖️ ปรับยอดออเดอร์นี้ให้ตรง ${source.platform}</button></div>`;
}

function marketplaceSaleAdjustItemNet(item, price = Number(item.sell_price || 0)) {
  const gross = Number(item.qty || 0) * price;
  const discount = Number(item.discount || 0);
  return Math.max(0, item.discount_type === 'percent' ? gross * (1 - discount / 100) : gross - discount);
}

// Pure preview plan. A bill-level discount preserves existing item prices when possible.
function marketplaceSaleAdjustPlan(order, targetSale) {
  const target = marketplaceAdjustMoney(targetSale);
  const items = order.order_items || [];
  const shipping = marketplaceAdjustMoney(getOrderShippingFee(order));
  if (!Number.isFinite(target) || target < 0 || !items.length || items.some(item => !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0)) return { error:'รายการสินค้า/ยอดขายไม่ถูกต้อง' };
  if (target < shipping - 0.001) return { error:'ยอดแพลตฟอร์มต่ำกว่าค่าขนส่งในออเดอร์ กรุณาตรวจรายการนี้เอง' };
  let subtotal = items.reduce((sum, item) => sum + marketplaceSaleAdjustItemNet(item), 0);
  let itemChange = null;
  if (target > subtotal + shipping + 0.001) {
    const item = items.find(row => row.id && marketplaceSaleAdjustItemNet(row) > 0 && (row.discount_type !== 'percent' || Number(row.discount || 0) < 100)) ||
      items.find(row => row.id && (row.discount_type !== 'percent' || Number(row.discount || 0) < 100));
    if (!item) return { error:'ไม่พบรายการสินค้าที่ปรับราคาได้' };
    const qty = Number(item.qty);
    const factor = item.discount_type === 'percent' ? 1 - Number(item.discount || 0) / 100 : 1;
    const extra = target - subtotal - shipping;
    const oldPrice = Number(item.sell_price || 0);
    const baseNet = marketplaceSaleAdjustItemNet(item);
    const desiredNet = baseNet + extra;
    const amountDiscount = item.discount_type === 'percent' ? 0 : Number(item.discount || 0);
    const newPrice = Math.ceil(((desiredNet + amountDiscount) / (qty * factor)) * 100 - 1e-9) / 100;
    if (!Number.isFinite(newPrice) || newPrice < 0) return { error:'คำนวณราคาใหม่ไม่ได้' };
    subtotal += marketplaceSaleAdjustItemNet(item, newPrice) - marketplaceSaleAdjustItemNet(item);
    itemChange = { id:item.id, oldPrice, newPrice };
  }
  const billDiscount = marketplaceAdjustMoney(subtotal + shipping - target);
  if (billDiscount < -0.001 || Math.abs(marketplaceAdjustMoney(subtotal - billDiscount + shipping) - target) > 0.01) return { error:'คำนวณยอดสุทธิไม่ตรง กรุณาตรวจรายการนี้เอง' };
  return { target, oldTotal:marketplaceAdjustMoney(order.total_amount || 0), billDiscount, shipping, itemChange };
}

async function marketplaceAdjustFetchAll(table, columns, configure) {
  const result = [];
  for (let start = 0; ; start += 250) {
    let query = sb.from(table).select(columns).eq('shop_id', currentShop.id).order('id', {ascending:true}).range(start, start + 249);
    if (configure) query = configure(query);
    const { data, error } = await query;
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < 250) break;
  }
  return result;
}

async function openMarketplaceSaleAdjust(onlyOrderId = null) {
  document.getElementById('modal-marketplace-sale-adjust')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'modal-marketplace-sale-adjust';
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = getNextModalZIndex();
  overlay.innerHTML = `<div class="modal" style="max-width:1050px;width:100%;max-height:92vh;overflow:auto"><div class="modal-title">⚖️ ปรับยอดขาย Order ให้ตรง Shopee/Lazada</div><div id="marketplace-adjust-content" class="loading"><div class="spinner"></div></div></div>`;
  overlay.addEventListener('click', event => { if (event.target === overlay && !_marketplaceAdjustBusy) overlay.remove(); });
  document.body.appendChild(overlay);
  ensureModalCloseButton(overlay, () => { if (!_marketplaceAdjustBusy) overlay.remove(); });
  try {
    await Promise.all([ensureShopeeOrderReconciliation(), ensureLazadaSummary()]);
    const [orders, invoices] = await Promise.all([
      onlyOrderId
        ? sb.from('orders').select('*,order_items(*)').eq('shop_id', currentShop.id).eq('id', onlyOrderId).then(({data,error}) => { if(error) throw error; return data || []; })
        : marketplaceAdjustFetchAll('orders', '*,order_items(*)'),
      marketplaceAdjustFetchAll('ar_invoices', 'order_id,status', query => query.neq('status', 'cancelled'))
    ]);
    const invoiced = new Set(invoices.map(row => row.order_id));
    _marketplaceAdjustRows = orders.map(order => {
      const source = marketplaceSaleAdjustMatch(order);
      if (!source || source.recon.status !== 'matched') return null;
      const target = marketplaceAdjustMoney(source.recon.match.sale);
      if (Math.abs(marketplaceAdjustMoney(order.total_amount) - target) <= 0.01) return null;
      const reason = isOrderCancelled(order) ? 'ออเดอร์ยกเลิก' : invoiced.has(order.id) ? 'มี AR Invoice' : '';
      const plan = reason ? {error:reason} : marketplaceSaleAdjustPlan(order, target);
      return {order, platform:source.platform, target, plan, selected:!plan.error};
    }).filter(Boolean);
    marketplaceSaleAdjustRender();
  } catch (error) {
    console.error('marketplace adjustment preview failed:', error);
    const content = document.getElementById('marketplace-adjust-content');
    if (content) content.innerHTML = `<div style="color:var(--red);padding:12px">โหลดข้อมูลไม่สำเร็จ: ${escapeHTML(error.message || 'เกิดข้อผิดพลาด')}</div>`;
  }
}

function marketplaceSaleAdjustRender(message = '') {
  const content = document.getElementById('marketplace-adjust-content');
  if (!content) return;
  const eligible = _marketplaceAdjustRows.filter(row => !row.plan.error && !row.done);
  const selected = eligible.filter(row => row.selected);
  const delta = selected.reduce((sum,row) => sum + row.target - Number(row.order.total_amount || 0), 0);
  content.innerHTML = `<div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:10px">ใช้เฉพาะออเดอร์ที่จับคู่เลขอ้างอิงไม่ซ้ำและข้อมูลแพลตฟอร์มซิงค์ขึ้นเซิร์ฟเวอร์แล้ว · ยอดเป้าหมายคือ <b>ยอดขายสินค้า</b> ไม่ใช่ยอดโอนหลังหักค่าธรรมเนียม · ข้ามออเดอร์ยกเลิก/มี AR Invoice · ไม่เปลี่ยนสต๊อก</div>
    ${message ? `<div style="background:#eff6ff;padding:9px;border-radius:7px;margin-bottom:10px">${escapeHTML(message)}</div>` : ''}
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-secondary btn-sm" onclick="marketplaceSaleAdjustSelectAll(true)">เลือกทั้งหมดที่ปรับได้</button><button class="btn btn-secondary btn-sm" onclick="marketplaceSaleAdjustSelectAll(false)">ล้างการเลือก</button><span style="font-size:12px">พบยอดต่าง ${_marketplaceAdjustRows.length} ออเดอร์ · ปรับได้ ${eligible.length} · เลือก ${selected.length} · ผลต่างรวม ${fmtB(delta)}</span></div>
    <div style="overflow:auto;max-height:55vh;border:1px solid var(--border);border-radius:8px"><table style="min-width:730px;font-size:12px"><thead><tr><th>เลือก</th><th>ออเดอร์ / ช่องทาง</th><th class="text-right">ยอดเดิม</th><th class="text-right">ยอดแพลตฟอร์ม</th><th class="text-right">เปลี่ยน</th><th>วิธีปรับ / สถานะ</th></tr></thead><tbody>${_marketplaceAdjustRows.map((row,index) => `<tr><td><input type="checkbox" ${row.selected?'checked':''} ${row.plan.error || row.done?'disabled':''} onchange="marketplaceSaleAdjustToggle(${index},this.checked)"></td><td><b>${escapeHTML(row.order.order_no || '-')}</b><br><span style="color:var(--text3)">${row.platform} · ${escapeHTML(row.order.customer_social || row.order.platform_order_id || '-')}</span></td><td class="text-right">${fmtB(row.done?row.plan.oldTotal:row.order.total_amount)}</td><td class="text-right">${fmtB(row.target)}</td><td class="text-right" style="color:${row.target-Number(row.done?row.plan.oldTotal:row.order.total_amount)<0?'#dc2626':'#15803d'}">${fmtB(row.target-Number(row.done?row.plan.oldTotal:row.order.total_amount))}</td><td>${row.done?'✅ ปรับแล้ว':row.plan.error?`⚠️ ${escapeHTML(row.plan.error)}`:row.plan.itemChange?`ราคา/ชิ้น ${fmtB(row.plan.itemChange.oldPrice)} → ${fmtB(row.plan.itemChange.newPrice)}; ส่วนลดบิล ${fmtB(row.plan.billDiscount)}`:`ส่วนลดบิล ${fmtB(row.plan.billDiscount)}`}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:18px">ไม่พบออเดอร์ที่ยอดต่างและปรับอัตโนมัติได้</td></tr>'}</tbody></table></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-secondary" onclick="document.getElementById('modal-marketplace-sale-adjust').remove()" ${_marketplaceAdjustBusy?'disabled':''}>ปิด</button><button class="btn btn-primary" id="marketplace-adjust-save" onclick="marketplaceSaleAdjustSave()" ${!selected.length || _marketplaceAdjustBusy?'disabled':''}>💾 ยืนยันปรับ ${selected.length} ออเดอร์</button></div>`;
}

function marketplaceSaleAdjustToggle(index, checked) {
  if (_marketplaceAdjustBusy) return;
  if (_marketplaceAdjustRows[index] && !_marketplaceAdjustRows[index].plan.error && !_marketplaceAdjustRows[index].done) _marketplaceAdjustRows[index].selected = checked;
  marketplaceSaleAdjustRender();
}
function marketplaceSaleAdjustSelectAll(checked) {
  if (_marketplaceAdjustBusy) return;
  _marketplaceAdjustRows.forEach(row => { row.selected = checked && !row.plan.error && !row.done; });
  marketplaceSaleAdjustRender();
}

async function marketplaceSaleAdjustApply(row) {
  const { data:current, error:readError } = await sb.from('orders').select('*,order_items(*)').eq('shop_id', currentShop.id).eq('id', row.order.id).single();
  if (readError || !current) throw readError || new Error('ไม่พบออเดอร์');
  const {data:ar, error:arError} = await sb.from('ar_invoices').select('id').eq('shop_id', currentShop.id).eq('order_id', current.id).neq('status', 'cancelled').limit(1);
  if (arError) throw arError;
  if (ar?.length) throw new Error('มี AR Invoice แล้ว');
  const source = marketplaceSaleAdjustMatch(current);
  if (isOrderCancelled(current) || source?.recon.status !== 'matched' || marketplaceAdjustMoney(source.recon.match.sale) !== row.target || marketplaceAdjustMoney(current.total_amount) !== marketplaceAdjustMoney(row.order.total_amount)) throw new Error('ข้อมูลเปลี่ยนหลังเปิดหน้าตรวจสอบ กรุณารีเฟรช');
  const plan = marketplaceSaleAdjustPlan(current, row.target);
  if (plan.error) throw new Error(plan.error);
  if (plan.itemChange) {
    const {data:changed,error} = await sb.from('order_items').update({sell_price:plan.itemChange.newPrice}).eq('id', plan.itemChange.id).eq('order_id', current.id).eq('sell_price', plan.itemChange.oldPrice).select('id');
    if (error || !changed?.length) throw error || new Error('ราคาสินค้าเปลี่ยนหลังเปิดหน้าตรวจสอบ');
  }
  const {data:saved, error:saveError} = await sb.from('orders').update({total_amount:plan.target,bill_discount:plan.billDiscount,bill_discount_type:'amount'}).eq('shop_id',currentShop.id).eq('id',current.id).eq('total_amount',current.total_amount).select('id');
  if (saveError || !saved?.length) {
    if (plan.itemChange) {
      const rollback = await sb.from('order_items').update({sell_price:plan.itemChange.oldPrice}).eq('id', plan.itemChange.id).eq('order_id', current.id).eq('sell_price',plan.itemChange.newPrice).select('id');
      if (rollback.error || !rollback.data?.length) throw new Error(`บันทึกออเดอร์ไม่สำเร็จและคืนราคาสินค้าเดิมไม่ได้: ${rollback.error?.message || 'ข้อมูลถูกแก้พร้อมกัน'} · กรุณาตรวจออเดอร์ทันที`);
    }
    throw saveError || new Error('ออเดอร์ถูกแก้พร้อมกัน กรุณารีเฟรช');
  }
  row.order.total_amount = plan.target;
  row.selected = false;
  row.done = true;
  return plan;
}

async function marketplaceSaleAdjustSave() {
  if (_marketplaceAdjustBusy) return;
  const selected = _marketplaceAdjustRows.filter(row => row.selected && !row.plan.error);
  if (!selected.length) return;
  const before = selected.reduce((sum,row) => sum + Number(row.order.total_amount || 0), 0);
  const after = selected.reduce((sum,row) => sum + row.target, 0);
  if (!confirm(`ยืนยันปรับยอดขาย ${selected.length} ออเดอร์ให้ตรง Shopee/Lazada?\nยอดเดิม ${fmtB(before)} → ยอดใหม่ ${fmtB(after)}\nส่วนต่าง ${fmtB(after-before)}\nออเดอร์ที่มี AR Invoice จะไม่ถูกแก้`)) return;
  _marketplaceAdjustBusy = true;
  marketplaceSaleAdjustRender('กำลังบันทึก...');
  let success = 0;
  const errors = [];
  for (const row of selected) {
    try { await marketplaceSaleAdjustApply(row); success++; }
    catch (error) { errors.push(`${row.order.order_no || row.order.id}: ${error.message || error}`); }
  }
  _marketplaceAdjustBusy = false;
  const message = `บันทึกสำเร็จ ${success}/${selected.length} ออเดอร์${errors.length ? ' · ไม่สำเร็จ: '+errors.slice(0,5).join(' | ')+(errors.length>5?' ...':'') : ''}`;
  marketplaceSaleAdjustRender(message);
  toast(message, errors.length ? 'error' : 'success');
  if (success && typeof loadOrders === 'function' && document.getElementById('ord-table')) loadOrders();
}

if (typeof module !== 'undefined' && module.exports) module.exports = { marketplaceSaleAdjustPlan, marketplaceSaleAdjustItemNet };
