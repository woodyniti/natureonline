// Reconcile the order sale (not platform payout) with verified marketplace data.
let _marketplaceAdjustRows = [];
let _marketplaceAdjustBusy = false;
let _marketplaceAdjustFilter = 'all';
let _marketplaceAdjustSearch = '';

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
  _marketplaceAdjustFilter = 'all';
  _marketplaceAdjustSearch = '';
  const overlay = document.createElement('div');
  overlay.id = 'modal-marketplace-sale-adjust';
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = getNextModalZIndex();
  overlay.innerHTML = `<div class="modal msa-dialog"><div class="msa-header"><div class="modal-title">⚖️ ปรับยอดขายให้ตรง Shopee / Lazada</div><div class="msa-subtitle">ตรวจยอดเดิมเทียบกับยอดขายจริง แล้วเลือกออเดอร์ที่ต้องการปรับ</div></div><div id="marketplace-adjust-content" class="loading"><div class="spinner"></div></div></div>`;
  overlay.addEventListener('click', event => { if (event.target === overlay && !_marketplaceAdjustBusy) overlay.remove(); });
  document.body.appendChild(overlay);
  ensureModalCloseButton(overlay, () => { if (!_marketplaceAdjustBusy) overlay.remove(); });
  try {
    await Promise.all([ensureShopeeOrderReconciliation(), ensureLazadaSummary()]);
    const [orders, invoices, paymentRows] = await Promise.all([
      onlyOrderId
        ? sb.from('orders').select('*,order_items(*)').eq('shop_id', currentShop.id).eq('id', onlyOrderId).then(({data,error}) => { if(error) throw error; return data || []; })
        : marketplaceAdjustFetchAll('orders', '*,order_items(*)'),
      marketplaceAdjustFetchAll('ar_invoices', 'id,ar_no,order_id,status,total_amount,paid_amount', query => query.neq('status', 'cancelled')),
      marketplaceAdjustFetchAll('ar_payments', 'ar_id,amount')
    ]);
    const invoiceByOrder = new Map(invoices.map(row => [row.order_id,row]));
    const invoiceCounts = new Map();
    invoices.forEach(row => invoiceCounts.set(row.order_id,(invoiceCounts.get(row.order_id)||0)+1));
    const paidByAR = new Map();
    paymentRows.forEach(row => paidByAR.set(row.ar_id,(paidByAR.get(row.ar_id)||0)+Number(row.amount||0)));
    _marketplaceAdjustRows = orders.map(order => {
      const source = marketplaceSaleAdjustMatch(order);
      if (!source || source.recon.status !== 'matched') return null;
      const target = marketplaceAdjustMoney(source.recon.match.sale);
      if (Math.abs(marketplaceAdjustMoney(order.total_amount) - target) <= 0.01) return null;
      const ar = invoiceByOrder.get(order.id) || null;
      const reason = isOrderCancelled(order) ? 'ออเดอร์ยกเลิก'
        : (invoiceCounts.get(order.id)||0)>1 ? 'มี AR Invoice ที่ยังใช้งานมากกว่าหนึ่งใบ · ต้องตรวจเอกสาร'
        : ar && Math.abs(marketplaceAdjustMoney(ar.total_amount)-marketplaceAdjustMoney(order.total_amount)) > 0.01 ? `AR ${ar.ar_no || ''} มียอดต่างจาก Order อยู่ก่อน · ต้องตรวจเอกสาร`
        : ar && Math.abs(marketplaceAdjustMoney(paidByAR.get(ar.id)||0)-marketplaceAdjustMoney(ar.paid_amount||0)) > 0.01 ? `AR ${ar.ar_no || ''} ยอดรับไม่ตรงประวัติการรับเงิน · ต้องตรวจก่อน` : '';
      const plan = reason ? {error:reason} : marketplaceSaleAdjustPlan(order, target);
      return {order, ar, platform:source.platform, target, plan, selected:!!onlyOrderId && !plan.error};
    }).filter(Boolean);
    marketplaceSaleAdjustRender();
  } catch (error) {
    console.error('marketplace adjustment preview failed:', error);
    const content = document.getElementById('marketplace-adjust-content');
    if (content) { content.classList.remove('loading'); content.innerHTML = `<div style="color:var(--red);padding:22px">โหลดข้อมูลไม่สำเร็จ: ${escapeHTML(error.message || 'เกิดข้อผิดพลาด')}</div>`; }
  }
}

function marketplaceSaleAdjustRender(message = '') {
  const content = document.getElementById('marketplace-adjust-content');
  if (!content) return;
  content.classList.remove('loading');
  const eligible = _marketplaceAdjustRows.filter(row => !row.plan.error && !row.done);
  const selected = eligible.filter(row => row.selected);
  const delta = selected.reduce((sum,row) => sum + row.target - Number(row.order.total_amount || 0), 0);
  const blocked = _marketplaceAdjustRows.filter(row => !!row.plan.error && !row.done).length;
  const q = _marketplaceAdjustSearch.trim().toLocaleLowerCase('th');
  const visible = _marketplaceAdjustRows.map((row,index) => ({row,index})).filter(({row}) => {
    if (_marketplaceAdjustFilter === 'ready' && (row.plan.error || row.done)) return false;
    if (_marketplaceAdjustFilter === 'blocked' && !row.plan.error) return false;
    return !q || [row.order.order_no,row.order.customer_social,row.order.platform_order_id,row.platform].some(value => String(value || '').toLocaleLowerCase('th').includes(q));
  });
  const rowInfo = row => {
    if (row.done) return '✅ ปรับยอดแล้ว';
    if (row.plan.error) return `⚠️ ${escapeHTML(row.plan.error)}`;
    const detail = row.plan.itemChange
      ? `ปรับราคา/ชิ้น ${fmtB(row.plan.itemChange.oldPrice)} → ${fmtB(row.plan.itemChange.newPrice)} · ส่วนลดบิล ${fmtB(row.plan.billDiscount)}`
      : `ปรับส่วนลดทั้งบิลเป็น ${fmtB(row.plan.billDiscount)}`;
    const overpaid = row.ar ? Math.max(0,marketplaceAdjustMoney(Number(row.ar.paid_amount||0)-row.target)) : 0;
    return row.ar ? `📄 ปรับพร้อม AR ${escapeHTML(row.ar.ar_no || '')} · ${detail}${overpaid>0?` · <b style="color:#c2410c">เงินรับเกิน ${fmtB(overpaid)}</b>`:''}` : detail;
  };
  const oldAmount = row => row.done ? row.plan.oldTotal : Number(row.order.total_amount || 0);
  const disabled = row => row.plan.error || row.done || _marketplaceAdjustBusy;
  const arButton = (row,index) => row.ar && !disabled(row) ? `<div style="margin-top:6px"><button type="button" class="btn btn-secondary btn-sm" onclick="marketplaceSaleAdjustSelectOne(${index})" style="background:#eff6ff;border-color:#93c5fd;color:#1d4ed8">ปรับ Order + AR ใบนี้</button></div>` : '';
  content.innerHTML = `<div class="msa-body">
    <div class="msa-notice">ยอดเป้าหมายคือ <b>ยอดขายสินค้า</b> ไม่ใช่ยอดโอนหลังหักค่าธรรมเนียม · ใช้เฉพาะข้อมูลแพลตฟอร์มที่ซิงค์แล้วและเลขอ้างอิงไม่ซ้ำ · AR จะปรับพร้อม Order โดยคงประวัติรับเงินจริงไว้ และแสดงเงินรับเกินแยกต่างหาก · การปรับนี้เป็นบันทึกภายใน ไม่ใช่ใบลดหนี้ทางภาษี</div>
    ${message ? `<div role="status" class="msa-notice">${escapeHTML(message)}</div>` : ''}
    <div class="msa-kpis"><div class="msa-kpi"><small>ยอดต่างทั้งหมด</small><strong>${_marketplaceAdjustRows.length} ออเดอร์</strong></div><div class="msa-kpi"><small>ปรับอัตโนมัติได้</small><strong style="color:#15803d">${eligible.length} ออเดอร์</strong></div><div class="msa-kpi"><small>ต้องตรวจเอง</small><strong style="color:#c2410c">${blocked} ออเดอร์</strong></div><div class="msa-kpi"><small>ผลต่างของที่เลือก</small><strong style="color:${delta<0?'#dc2626':'#15803d'}">${fmtB(delta)}</strong></div></div>
    <div class="msa-tools"><input class="msa-search" id="msa-search" type="search" value="${escapeHTML(_marketplaceAdjustSearch)}" placeholder="ค้นหาเลขออเดอร์ / เลขอ้างอิง" oninput="marketplaceSaleAdjustSetSearch(this)" aria-label="ค้นหาออเดอร์"><button class="msa-filter ${_marketplaceAdjustFilter==='all'?'active':''}" onclick="marketplaceSaleAdjustSetFilter('all')">ทั้งหมด (${_marketplaceAdjustRows.length})</button><button class="msa-filter ${_marketplaceAdjustFilter==='ready'?'active':''}" onclick="marketplaceSaleAdjustSetFilter('ready')">ปรับได้ (${eligible.length})</button><button class="msa-filter ${_marketplaceAdjustFilter==='blocked'?'active':''}" onclick="marketplaceSaleAdjustSetFilter('blocked')">ตรวจเอง (${blocked})</button></div>
    <div class="msa-selection"><button class="btn btn-secondary btn-sm" onclick="marketplaceSaleAdjustSelectAll(true)" ${_marketplaceAdjustBusy || !eligible.length?'disabled':''}>☑ เลือกทั้งหมดที่ปรับได้</button><button class="btn btn-secondary btn-sm" onclick="marketplaceSaleAdjustSelectAll(false)" ${_marketplaceAdjustBusy || !selected.length?'disabled':''}>ล้างการเลือก</button><span style="color:var(--text3)">เลือกแล้ว <b style="color:var(--text)">${selected.length}</b> ออเดอร์</span></div>
    <div class="msa-list"><table class="msa-table"><thead><tr><th style="width:45px">เลือก</th><th>ออเดอร์ / ช่องทาง</th><th class="text-right">ยอดเดิม</th><th class="text-right">ยอดแพลตฟอร์ม</th><th class="text-right">ส่วนต่าง</th><th>วิธีปรับ / สถานะ</th></tr></thead><tbody>${visible.map(({row,index}) => `<tr><td><input type="checkbox" aria-label="เลือก ${escapeHTML(row.order.order_no || row.order.id)}" ${row.selected?'checked':''} ${disabled(row)?'disabled':''} onchange="marketplaceSaleAdjustToggle(${index},this.checked)"></td><td class="msa-order"><b>${escapeHTML(row.order.order_no || '-')}</b><br><span class="msa-ref">${row.platform} · ${escapeHTML(row.order.customer_social || row.order.platform_order_id || '-')}</span></td><td class="text-right">${fmtB(oldAmount(row))}</td><td class="text-right"><b>${fmtB(row.target)}</b></td><td class="text-right" style="color:${row.target-oldAmount(row)<0?'#dc2626':'#15803d'}">${fmtB(row.target-oldAmount(row))}</td><td class="msa-method">${rowInfo(row)}${arButton(row,index)}</td></tr>`).join('') || '<tr><td colspan="6" style="padding:26px;text-align:center;color:var(--text3)">ไม่พบออเดอร์ในตัวกรองนี้</td></tr>'}</tbody></table>
    <div class="msa-mobile-list">${visible.map(({row,index}) => `<div class="msa-card"><div class="msa-card-top"><input class="msa-card-check" type="checkbox" aria-label="เลือก ${escapeHTML(row.order.order_no || row.order.id)}" ${row.selected?'checked':''} ${disabled(row)?'disabled':''} onchange="marketplaceSaleAdjustToggle(${index},this.checked)"><div class="msa-card-order">${escapeHTML(row.order.order_no || '-')}<div class="msa-card-ref">${row.platform} · ${escapeHTML(row.order.customer_social || row.order.platform_order_id || '-')}</div></div></div><div class="msa-card-values"><div><span>ยอดเดิม</span><b>${fmtB(oldAmount(row))}</b></div><div><span>แพลตฟอร์ม</span><b>${fmtB(row.target)}</b></div><div><span>ส่วนต่าง</span><b style="color:${row.target-oldAmount(row)<0?'#dc2626':'#15803d'}">${fmtB(row.target-oldAmount(row))}</b></div></div><div style="font-size:11px;color:${row.plan.error?'#c2410c':'var(--text2)'}">${rowInfo(row)}</div>${arButton(row,index)}</div>`).join('') || '<div style="padding:26px;text-align:center;color:var(--text3)">ไม่พบออเดอร์ในตัวกรองนี้</div>'}</div></div>
  </div><div class="msa-footer"><div class="msa-footer-summary">เลือก <b>${selected.length}</b> ออเดอร์ · ยอดเดิม <b>${fmtB(selected.reduce((sum,row)=>sum+Number(row.order.total_amount||0),0))}</b> → ยอดใหม่ <b>${fmtB(selected.reduce((sum,row)=>sum+row.target,0))}</b></div><div class="msa-footer-actions"><button class="btn btn-secondary" onclick="document.getElementById('modal-marketplace-sale-adjust').remove()" ${_marketplaceAdjustBusy?'disabled':''}>ปิด</button><button class="btn btn-primary" id="marketplace-adjust-save" onclick="marketplaceSaleAdjustSave()" ${!selected.length || _marketplaceAdjustBusy?'disabled':''}>💾 ยืนยันปรับ ${selected.length} ออเดอร์</button></div></div>`;
}

function marketplaceSaleAdjustSetFilter(value) {
  if (_marketplaceAdjustBusy) return;
  _marketplaceAdjustFilter = value;
  marketplaceSaleAdjustRender();
}
function marketplaceSaleAdjustSetSearch(input) {
  if (_marketplaceAdjustBusy) return;
  _marketplaceAdjustSearch = input.value;
  const position = input.selectionStart;
  marketplaceSaleAdjustRender();
  const next = document.getElementById('msa-search');
  if (next) { next.focus(); next.setSelectionRange(position,position); }
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
function marketplaceSaleAdjustSelectOne(index) {
  if (_marketplaceAdjustBusy) return;
  const row = _marketplaceAdjustRows[index];
  if (!row || row.plan.error || row.done) return;
  _marketplaceAdjustRows.forEach(item => { item.selected=false; });
  row.selected=true;
  marketplaceSaleAdjustRender();
  marketplaceSaleAdjustSave();
}

async function marketplaceSaleAdjustApply(row) {
  const { data:current, error:readError } = await sb.from('orders').select('*,order_items(*)').eq('shop_id', currentShop.id).eq('id', row.order.id).single();
  if (readError || !current) throw readError || new Error('ไม่พบออเดอร์');
  const {data:ar, error:arError} = await sb.from('ar_invoices').select('id,ar_no,total_amount,paid_amount,status').eq('shop_id', currentShop.id).eq('order_id', current.id).neq('status', 'cancelled').limit(2);
  if (arError) throw arError;
  if ((ar||[]).length > 1 || (ar?.[0]?.id||null) !== (row.ar?.id||null)) throw new Error('AR Invoice เปลี่ยนหลังเปิดหน้าตรวจสอบ กรุณารีเฟรช');
  const source = marketplaceSaleAdjustMatch(current);
  if (isOrderCancelled(current) || source?.recon.status !== 'matched' || marketplaceAdjustMoney(source.recon.match.sale) !== row.target || marketplaceAdjustMoney(current.total_amount) !== marketplaceAdjustMoney(row.order.total_amount)) throw new Error('ข้อมูลเปลี่ยนหลังเปิดหน้าตรวจสอบ กรุณารีเฟรช');
  const plan = marketplaceSaleAdjustPlan(current, row.target);
  if (plan.error) throw new Error(plan.error);
  if (ar?.length) {
    const invoice = ar[0];
    if (marketplaceAdjustMoney(invoice.total_amount) !== marketplaceAdjustMoney(row.ar.total_amount) ||
        marketplaceAdjustMoney(invoice.paid_amount||0) !== marketplaceAdjustMoney(row.ar.paid_amount||0)) throw new Error('ยอด AR เปลี่ยนหลังเปิดหน้าตรวจสอบ กรุณารีเฟรช');
    const {data,error} = await sb.rpc('apply_marketplace_ar_sale_adjustment',{
      p_order_id:current.id,p_ar_id:invoice.id,p_expected_order_total:Number(current.total_amount||0),
      p_expected_ar_total:Number(invoice.total_amount||0),p_expected_paid:Number(invoice.paid_amount||0),
      p_target:plan.target,p_bill_discount:plan.billDiscount,p_item_id:plan.itemChange?.id||null,
      p_expected_item_price:plan.itemChange?.oldPrice??null,p_new_item_price:plan.itemChange?.newPrice??null,
      p_platform:row.platform,p_source_ref:source.recon.ref
    });
    if (error) throw new Error((error.code==='PGRST202' || /apply_marketplace_ar_sale_adjustment/i.test(error.message||''))
      ? 'ยังไม่ได้ติดตั้ง SQL สำหรับปรับ AR: supabase_marketplace_ar_adjust_v302.sql' : error.message);
    if (!data || marketplaceAdjustMoney(data.ar_total) !== plan.target || marketplaceAdjustMoney(data.order_total) !== plan.target) throw new Error('เซิร์ฟเวอร์ไม่ยืนยันยอด Order/AR ที่ปรับ กรุณาตรวจเอกสาร');
    row.order.total_amount=plan.target;row.selected=false;row.done=true;
    return plan;
  }
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
  const linkedAR = selected.filter(row=>!!row.ar).length;
  const overpaid = selected.reduce((sum,row)=>sum+(row.ar?Math.max(0,Number(row.ar.paid_amount||0)-row.target):0),0);
  if (!confirm(`ยืนยันปรับยอดขาย ${selected.length} ออเดอร์ให้ตรง Shopee/Lazada?\nยอดเดิม ${fmtB(before)} → ยอดใหม่ ${fmtB(after)}\nส่วนต่าง ${fmtB(after-before)}\nปรับพร้อม AR Invoice ${linkedAR} ใบ${overpaid>0?'\nเงินรับเกินหลังปรับ '+fmtB(overpaid)+' (คงประวัติรับเงินจริง)':''}\nบันทึกนี้เป็นการปรับภายใน ไม่ใช่ใบลดหนี้ทางภาษี`)) return;
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

if (typeof module !== 'undefined' && module.exports) module.exports = { marketplaceSaleAdjustPlan, marketplaceSaleAdjustItemNet, marketplaceSaleAdjustApply };
