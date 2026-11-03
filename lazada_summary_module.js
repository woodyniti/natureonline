// SEALTHAI Lazada order/settlement review. Financial rows are keyed by orderItemId,
// not by the month of the order: a June sale can settle or be adjusted in July.
var _lazadaItems = [];
var _lazadaServerItemIds = new Set();
var _lazadaIndex = new Map();
var _lazadaSource = 'preloaded';
var _lazadaLoadedShop = null;
var _lazadaPeriod = 'all';
var _lazadaTab = 'overview';
var _lazadaSearch = '';
var _lazadaRefCounts = new Map();
var _lazadaRefReady = false;
var _lazadaProducts = [];
var _lazadaMappings = [];
var _lazadaLoadPromise = null;

function lazadaMoney(value) { return Math.round((Number(String(value ?? 0).replace(/[฿,\s]/g, '')) || 0) * 100) / 100; }
function lazadaText(value) { return String(value ?? '').trim(); }
function lazadaSafe(value) { return escapeHTML(lazadaText(value)); }
function lazadaItemKey(item) { return lazadaText(item?.orderItemId); }
function lazadaTxKey(tx) {
  return [tx.date, tx.statement, tx.type, lazadaMoney(tx.amount), lazadaMoney(tx.vat), lazadaMoney(tx.wht)].join('|');
}
function lazadaMergeItems(first, second) {
  const map = new Map();
  [...(first || []), ...(second || [])].forEach(item => {
    const key = lazadaItemKey(item);
    if (!key) return;
    const old = map.get(key);
    if (!old) { map.set(key, { ...item, transactions: [...(item.transactions || [])] }); return; }
    const counts = new Map();
    (old.transactions || []).forEach(tx => counts.set(lazadaTxKey(tx), (counts.get(lazadaTxKey(tx)) || 0) + 1));
    (item.transactions || []).forEach(tx => {
      const k = lazadaTxKey(tx);
      if (counts.get(k)) { counts.set(k, counts.get(k) - 1); return; }
      old.transactions.push(tx);
    });
    // A later order export can refresh product/status fields without erasing settlement history.
    Object.keys(item).forEach(field => {
      if (field === 'transactions') return;
      if (old.hasOrder && !item.hasOrder && field !== 'orderId') return;
      if (item[field] !== '' && item[field] !== null && item[field] !== undefined) old[field] = item[field];
    });
  });
  return [...map.values()].sort((a, b) => (a.orderDate || '').localeCompare(b.orderDate || '') || a.orderId.localeCompare(b.orderId) || a.orderItemId.localeCompare(b.orderItemId));
}
function lazadaBuildIndex() {
  _lazadaIndex = new Map();
  _lazadaItems.forEach(item => {
    const ref = lazadaText(item.orderId).toUpperCase();
    if (!ref) return;
    if (!_lazadaIndex.has(ref)) _lazadaIndex.set(ref, { ref, items: [], sale: 0, payout: 0, fee: 0, pending: 0 });
    const group = _lazadaIndex.get(ref);
    group.items.push(item);
    const tx = item.transactions || [];
    const sale = tx.filter(row => row.type === 'ยอดรวมค่าสินค้า').reduce((sum, row) => sum + lazadaMoney(row.amount), 0);
    const payout = tx.reduce((sum, row) => sum + lazadaMoney(row.amount), 0);
    group.sale += sale;
    group.payout += payout;
    if (item.hasOrder && !tx.some(row => row.type === 'ยอดรวมค่าสินค้า')) group.pending++;
  });
  _lazadaIndex.forEach(group => {
    group.sale = lazadaMoney(group.sale);
    group.payout = lazadaMoney(group.payout);
    group.fee = lazadaMoney(group.sale - group.payout); // Includes discounts, rebates and adjustments.
  });
}
async function lazadaLoadServerItems() {
  if (!sb || !currentShop?.id || !currentUser?.id) return [];
  const result = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await sb.from('lazada_summary_items').select('order_item_id,payload')
      .eq('shop_id', currentShop.id).order('order_item_id').range(offset, offset + 499);
    if (error) throw error;
    (data || []).forEach(row => { if (row.payload && row.order_item_id) result.push(row.payload); });
    if (!data || data.length < 500) break;
  }
  return result;
}
async function lazadaLoadReferenceCounts() {
  _lazadaRefCounts = new Map(); _lazadaRefReady = false;
  if (!sb || !currentShop?.id) return;
  try {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await sb.from('orders').select('customer_social,platform_order_id,channel')
        .eq('shop_id', currentShop.id).order('id').range(offset, offset + 499);
      if (error) throw error;
      (data || []).forEach(order => {
        if (!lazadaText(order.channel).toLowerCase().includes('lazada')) return;
        const ref = lazadaText(order.customer_social || order.platform_order_id).toUpperCase();
        if (ref) _lazadaRefCounts.set(ref, (_lazadaRefCounts.get(ref) || 0) + 1);
      });
      if (!data || data.length < 500) break;
    }
    _lazadaRefReady = true;
  } catch (error) { console.warn('Lazada reference check unavailable:', error); }
}
async function ensureLazadaSummary(force = false) {
  if (!force && _lazadaLoadedShop === currentShop?.id) return;
  if (_lazadaLoadPromise) return _lazadaLoadPromise;
  _lazadaLoadPromise = lazadaLoadSummary(force).finally(() => { _lazadaLoadPromise = null; });
  return _lazadaLoadPromise;
}
async function lazadaLoadSummary(force = false) {
  if (!force && _lazadaLoadedShop === currentShop?.id) return;
  // Never publish private settlement data in a static website asset.
  const seed = [];
  let cached = [];
  try { cached = JSON.parse(sessionStorage.getItem('lazada_summary_items_cache:' + currentShop?.id) || '[]'); } catch (_) {}
  _lazadaItems = lazadaMergeItems(seed, Array.isArray(cached) ? cached : []);
  _lazadaServerItemIds = new Set(); _lazadaSource = 'preloaded';
  try {
    const server = await lazadaLoadServerItems();
    server.forEach(item => _lazadaServerItemIds.add(lazadaItemKey(item)));
    if (server.length) { _lazadaItems = lazadaMergeItems(_lazadaItems, server); _lazadaSource = 'server'; }
  } catch (error) { console.warn('Lazada server data unavailable:', error); }
  if (sb && currentShop?.id) {
    const [products, mappings] = await Promise.all([
      sb.from('products').select('id,name,sku,supplier_sku,current_cost,stock_qty,sell_price').eq('shop_id', currentShop.id),
      sb.from('marketplace_sku_mappings').select('platform_sku,product_id').eq('shop_id', currentShop.id).eq('channel', 'lazada')
    ]);
    _lazadaProducts = products.data || [];
    _lazadaMappings = mappings.data || [];
  }
  await lazadaLoadReferenceCounts();
  _lazadaLoadedShop = currentShop?.id || null;
  lazadaBuildIndex();
}
function getOrderLazadaReconciliation(order) {
  if (!lazadaText(order?.channel).toLowerCase().includes('lazada')) return { status: 'other' };
  const ref = lazadaText(order.customer_social || order.platform_order_id).toUpperCase();
  if (!ref) return { status: 'missing_ref' };
  if (!_lazadaItems.length || _lazadaLoadedShop !== currentShop?.id) return { status: 'loading', ref };
  if (!_lazadaRefReady) return { status: 'unverified', ref };
  if ((_lazadaRefCounts.get(ref) || 0) > 1) return { status: 'duplicate', ref };
  const match = _lazadaIndex.get(ref);
  if (!match) return { status: 'not_found', ref };
  if (match.pending || match.sale <= 0) return { status: 'pending_finance', ref, match };
  if (match.items.some(item => !_lazadaServerItemIds.has(item.orderItemId))) return { status: 'local_only', ref, match };
  return { status: 'matched', ref, match, source: 'server' };
}
function lazadaProductFor(item) {
  const sku = lazadaText(item.sellerSku).toUpperCase();
  const mapping = _lazadaMappings.find(row => lazadaText(row.platform_sku).toUpperCase() === sku);
  return _lazadaProducts.find(product => product.id === mapping?.product_id) ||
    _lazadaProducts.find(product => sku && [product.sku, product.supplier_sku].some(code => lazadaText(code).toUpperCase() === sku)) || null;
}
function lazadaMonths() { return [...new Set(_lazadaItems.map(item => lazadaText(item.orderDate).slice(0, 7)).filter(Boolean))].sort(); }
function lazadaVisibleItems() {
  const q = _lazadaSearch.toLocaleLowerCase('th');
  return _lazadaItems.filter(item => item.hasOrder && (_lazadaPeriod === 'all' || item.orderDate?.startsWith(_lazadaPeriod)) &&
    (!q || [item.orderId, item.orderItemId, item.sellerSku, item.name, item.variation].some(v => lazadaText(v).toLocaleLowerCase('th').includes(q))));
}
function lazadaItemFinancial(item) {
  const tx = item.transactions || [];
  const sale = lazadaMoney(tx.filter(row => row.type === 'ยอดรวมค่าสินค้า').reduce((sum, row) => sum + lazadaMoney(row.amount), 0));
  const payout = lazadaMoney(tx.reduce((sum, row) => sum + lazadaMoney(row.amount), 0));
  const product = lazadaProductFor(item);
  const cost = Number(product?.current_cost) || 0;
  return { sale, payout, deductions: lazadaMoney(sale - payout), cost, profit: lazadaMoney(payout - cost), product };
}
async function lazadaSummary() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-secondary btn-sm" onclick="lazadaSummaryRefresh()">🔄 รีเฟรช</button>
    <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0">📂 อัปโหลด Lazada<input type="file" accept=".xlsx" multiple style="display:none" onchange="lazadaUploadFiles(this)"></label>
    <button class="btn btn-secondary btn-sm" id="lazada-sync-btn" onclick="lazadaSyncServer()">☁️ ซิงค์ขึ้นเซิร์ฟเวอร์</button>
    <button class="btn btn-secondary btn-sm" onclick="lazadaExportCSV()">📥 ส่งออก CSV</button>`;
  document.getElementById('page-content').innerHTML = '<div class="loading"><div class="spinner"></div> กำลังโหลดข้อมูล Lazada...</div>';
  await ensureLazadaSummary();
  lazadaRender();
}
async function lazadaSummaryRefresh() { _lazadaLoadedShop = null; await lazadaSummary(); }
function lazadaRender() {
  const el = document.getElementById('page-content'); if (!el) return;
  if (!_lazadaItems.length) {
    el.innerHTML = `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:10px;padding:18px;color:#9a3412">
      <b>ยังไม่มีข้อมูล Lazada บนเซิร์ฟเวอร์</b><div style="margin-top:6px;font-size:12px">ติดตั้งตารางด้วยไฟล์ supabase_lazada_sync_v298.sql แล้วนำเข้าข้อมูล หรือกด “อัปโหลด Lazada” ด้านบนเพื่ออ่านไฟล์ในเบราว์เซอร์ก่อนซิงค์ ข้อมูลยังไม่สร้างออเดอร์หรือหักสต๊อกซ้ำ</div></div>`;
    return;
  }
  const visible = lazadaVisibleItems();
  const groups = new Set(visible.map(item => item.orderId));
  const financial = visible.map(lazadaItemFinancial);
  const sale = lazadaMoney(financial.reduce((sum, row) => sum + row.sale, 0));
  const payout = lazadaMoney(financial.reduce((sum, row) => sum + row.payout, 0));
  const cost = lazadaMoney(financial.reduce((sum, row) => sum + row.cost, 0));
  const pending = visible.filter(item => !(item.transactions || []).some(tx => tx.type === 'ยอดรวมค่าสินค้า')).length;
  const linked = visible.filter(item => !!lazadaProductFor(item)).length;
  const months = lazadaMonths();
  el.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
    <div><b style="display:inline-flex;align-items:center;gap:8px"><img class="marketplace-summary-logo report-logo" src="assets/lazada-summary-logo.png" alt="Lazada logo">Lazada Executive Summary & Planning</b><div style="font-size:11px;color:var(--text3)">ออเดอร์ตามเดือนที่สั่งซื้อ · ยอดรับเงินจริงรวมรายการปรับปรุงข้ามเดือน · ${_lazadaServerItemIds.size.toLocaleString('th-TH')}/${_lazadaItems.length.toLocaleString('th-TH')} รายการยืนยันบนเซิร์ฟเวอร์</div></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-sm ${_lazadaPeriod==='all'?'btn-primary':'btn-secondary'}" onclick="lazadaSetPeriod('all')">ทั้งหมด</button>${months.map(month => `<button class="btn btn-sm ${_lazadaPeriod===month?'btn-primary':'btn-secondary'}" onclick="lazadaSetPeriod('${month}')">${escapeHTML(formatShopeeSummaryMonth(month))}</button>`).join('')}</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px;margin-bottom:13px">
      ${[['ยอดค่าสินค้าจริง',sale],['หลังหัก/ปรับปรุง',payout],['รายการที่ยังไม่รับเงิน',pending],['กำไรประมาณหลังต้นทุน',payout-cost]].map(([label,value],idx) => `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px"><div style="font-size:11px;color:var(--text3)">${label}</div><div style="font-size:19px;font-weight:800;color:${idx===3&&value<0?'#dc2626':'var(--text)'}">${idx===2?fmt(value):fmtB(value)}</div></div>`).join('')}
    </div><div style="font-size:11px;color:var(--text3);margin-bottom:10px">${groups.size} ออเดอร์ · ${visible.length} รายการสินค้า · เชื่อม SO ${_lazadaRefReady?[...groups].filter(ref=>_lazadaRefCounts.get(lazadaText(ref).toUpperCase())===1).length+'/'+groups.size:'รอตรวจ'} · จับคู่สินค้า ${linked}/${visible.length} · ข้อมูลต้นทุนใช้ต้นทุนสินค้าปัจจุบัน จึงเป็นกำไรประมาณ ไม่ใช่ต้นทุน ณ วันที่ขาย</div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-sm ${_lazadaTab==='overview'?'btn-primary':'btn-secondary'}" onclick="lazadaSetTab('overview')">📊 ภาพรวมสินค้า</button><button class="btn btn-sm ${_lazadaTab==='orders'?'btn-primary':'btn-secondary'}" onclick="lazadaSetTab('orders')">🧾 ออเดอร์ & รายรับ</button><button class="btn btn-sm ${_lazadaTab==='linkage'?'btn-primary':'btn-secondary'}" onclick="lazadaSetTab('linkage')">🔗 เชื่อม SKU / วางแผนสต๊อก</button></div>
    <input class="form-control" style="width:100%;max-width:420px;margin-bottom:12px" placeholder="ค้นหาเลขออเดอร์ / SKU / ชื่อสินค้า" value="${lazadaSafe(_lazadaSearch)}" oninput="lazadaSearch(this.value)">
    <div id="lazada-tab-content">${_lazadaTab==='orders'?lazadaRenderOrders(visible):_lazadaTab==='linkage'?lazadaRenderLinkage(visible):lazadaRenderOverview(visible)}</div>`;
}
function lazadaSetPeriod(value) { _lazadaPeriod = value; lazadaRender(); }
function lazadaSetTab(value) { _lazadaTab = value; lazadaRender(); }
function lazadaSearch(value) { _lazadaSearch = value; const el = document.getElementById('lazada-tab-content'); if (el) el.innerHTML = _lazadaTab==='orders'?lazadaRenderOrders(lazadaVisibleItems()):_lazadaTab==='linkage'?lazadaRenderLinkage(lazadaVisibleItems()):lazadaRenderOverview(lazadaVisibleItems()); }
function lazadaTable(headers, body) { return `<div style="overflow-x:auto;background:var(--bg2);border:1px solid var(--border);border-radius:9px"><table style="min-width:850px;width:100%;font-size:12px"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body || '<tr><td colspan="9" style="padding:20px;text-align:center">ไม่พบรายการ</td></tr>'}</tbody></table></div>`; }
function lazadaRenderOverview(items) {
  const map = new Map();
  items.forEach(item => { const sku = item.sellerSku || item.lazadaSku || item.name; if (!map.has(sku)) map.set(sku, {sku,name:item.name,units:0,sale:0,payout:0,stock:lazadaProductFor(item)?.stock_qty,product:lazadaProductFor(item)}); const row=map.get(sku); const f=lazadaItemFinancial(item); row.units++; row.sale+=f.sale; row.payout+=f.payout; });
  const body=[...map.values()].sort((a,b)=>b.sale-a.sale).map(row => `<tr><td class="font-mono">${lazadaSafe(row.sku)}</td><td>${lazadaSafe(row.name)}</td><td class="text-right">${row.units}</td><td class="text-right">${fmtB(row.sale)}</td><td class="text-right">${fmtB(row.payout)}</td><td class="text-right">${row.product?fmt(row.stock):'<span style="color:#dc2626">ไม่เชื่อม</span>'}</td></tr>`).join('');
  return lazadaTable(['SKU ร้าน','สินค้า','ชิ้น','ยอดค่าสินค้า','หลังหัก/ปรับปรุง','สต๊อก'],body);
}
function lazadaRenderOrders(items) {
  const refs=[...new Set(items.map(item=>item.orderId))];
  const body=refs.map(ref => {const group=_lazadaIndex.get(ref);const localItems=items.filter(item=>item.orderId===ref);const synced=localItems.every(item=>_lazadaServerItemIds.has(item.orderItemId));const refCount=_lazadaRefCounts.get(lazadaText(ref).toUpperCase())||0;return `<tr><td class="font-mono">${lazadaSafe(ref)}</td><td>${lazadaSafe(localItems[0]?.orderDate)}</td><td class="text-right">${localItems.length}</td><td class="text-right">${fmtB(group?.sale)}</td><td class="text-right">${fmtB(group?.payout)}</td><td>${_lazadaRefReady?(refCount===1?'✅ เชื่อม SO':refCount>1?'⚠️ SO ซ้ำ':'ยังไม่เชื่อม SO'):'รอตรวจ'}</td><td>${group?.pending?'⏳ รอรับเงิน '+group.pending+' รายการ':synced?'✅ ซิงค์แล้ว':'⚠️ ในเครื่อง'}</td><td><button class="btn btn-secondary btn-sm" data-ref="${lazadaSafe(ref)}" onclick="lazadaOpenOrder(this.dataset.ref)">ดูรายการ 🔎</button></td></tr>`;}).join('');
  return lazadaTable(['เลข Lazada','วันที่สั่ง','สินค้า','ยอดค่าสินค้า','หลังหัก/ปรับปรุง','เชื่อม SO','สถานะรายรับ','รายละเอียด'],body);
}
function lazadaRenderLinkage(items) {
  const unique=[...new Map(items.map(item=>[item.sellerSku,item])).values()].filter(item=>item.sellerSku);
  const body=unique.sort((a,b)=>a.sellerSku.localeCompare(b.sellerSku)).map(item=>{const product=lazadaProductFor(item);return `<tr><td class="font-mono">${lazadaSafe(item.sellerSku)}</td><td>${lazadaSafe(item.name)}</td><td>${product?lazadaSafe(product.sku+' · '+product.name):'<span style="color:#dc2626">ยังไม่เชื่อม</span>'}</td><td class="text-right">${product?fmt(product.stock_qty):'-'}</td><td>${product?'':'<input type="search" id="lz-search-'+lazadaSafe(item.sellerSku)+'" placeholder="ค้นหา SKU / ชื่อสินค้า" oninput="lazadaFilterProducts(this.dataset.sku,this.value)" data-sku="'+lazadaSafe(item.sellerSku)+'" style="width:180px"><select id="lz-map-'+lazadaSafe(item.sellerSku)+'" style="max-width:240px"><option value="">เลือกสินค้า</option></select><button class="btn btn-primary btn-sm" data-sku="'+lazadaSafe(item.sellerSku)+'" onclick="lazadaSaveMapping(this.dataset.sku)">บันทึก</button>'}</td></tr>`}).join('');
  return `<div style="font-size:11px;color:var(--text3);margin-bottom:8px">จับคู่ SKU ร้าน Lazada กับสินค้าในระบบเพื่อแสดงสต๊อกและต้นทุน · การนำเข้าไฟล์นี้ไม่ตัดสต๊อกและไม่สร้าง Sales Order ซ้ำ</div>${lazadaTable(['SKU Lazada','ชื่อสินค้า','สินค้าในระบบ','สต๊อก','เชื่อมโยง'],body)}`;
}
function lazadaFilterProducts(sku, query) {
  const select=document.getElementById('lz-map-'+sku);if(!select)return;
  const q=lazadaText(query).toLocaleLowerCase('th');select.replaceChildren(new Option('เลือกสินค้า',''));
  _lazadaProducts.filter(p=>[p.sku,p.supplier_sku,p.name].some(v=>lazadaText(v).toLocaleLowerCase('th').includes(q))).slice(0,100).forEach(p=>select.add(new Option(`${p.sku||''} · ${p.name} (ทุน ${fmtB(p.current_cost)}, สต๊อก ${fmt(p.stock_qty)})`,p.id)));
}
async function lazadaSaveMapping(sku) {
  const productId=document.getElementById('lz-map-'+sku)?.value;
  if(!productId){toast('กรุณาเลือกสินค้า','error');return;}
  const {error}=await sb.from('marketplace_sku_mappings').upsert({shop_id:currentShop.id,channel:'lazada',platform_sku:sku,product_id:productId},{onConflict:'shop_id,channel,platform_sku'});
  if(error){toast('บันทึกไม่สำเร็จ: '+error.message,'error');return;}
  _lazadaMappings=_lazadaMappings.filter(row=>row.platform_sku!==sku);_lazadaMappings.push({platform_sku:sku,product_id:productId});toast('เชื่อม SKU แล้ว','success');lazadaRender();
}
function lazadaOpenOrder(ref) {
  const group=_lazadaIndex.get(lazadaText(ref).toUpperCase());if(!group)return;
  document.getElementById('modal-lazada-drilldown')?.remove();
  const overlay=document.createElement('div');overlay.id='modal-lazada-drilldown';overlay.className='modal-overlay open';overlay.style.zIndex=getNextModalZIndex();
  const itemRows=group.items.map(item=>{const f=lazadaItemFinancial(item);return `<tr><td>${lazadaSafe(item.name)}${item.variation?' · '+lazadaSafe(item.variation):''}<div class="font-mono">${lazadaSafe(item.sellerSku)} · ${lazadaSafe(item.orderItemId)}</div></td><td class="text-right">${fmtB(item.unitPrice)}</td><td class="text-right">${fmtB(f.sale)}</td><td class="text-right">${fmtB(f.deductions)}</td><td class="text-right">${fmtB(f.payout)}</td><td>${(item.transactions||[]).map(tx=>`<div>${lazadaSafe(tx.date)} · ${lazadaSafe(tx.type)}: ${fmtB(tx.amount)}</div>`).join('')||'รอรายการรับเงิน'}</td></tr>`}).join('');
  overlay.innerHTML=`<div class="modal" style="width:100%;max-width:1050px;max-height:90vh;overflow:auto"><div class="modal-title">🛍️ Lazada ${lazadaSafe(ref)}</div><div style="font-size:12px;margin:8px 0">ยอดค่าสินค้า ${fmtB(group.sale)} · หลังหัก/ปรับปรุง ${fmtB(group.payout)} · ${group.pending?'รอรับเงิน '+group.pending+' รายการ':'รับเงินครบตามไฟล์'}</div>${lazadaTable(['สินค้า / SKU','ราคาในออเดอร์','ขายจริง','หัก/ปรับปรุง','หลังหัก','ธุรกรรม'],itemRows)}<div style="text-align:right;margin-top:12px"><button class="btn btn-secondary" onclick="document.getElementById('modal-lazada-drilldown').remove()">ปิด</button></div></div>`;
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.appendChild(overlay);ensureModalCloseButton(overlay,()=>overlay.remove());
}

function lazadaSheetRows(file, buffer) {
  if (!window.XLSX) throw new Error('ยังโหลดตัวอ่าน Excel ไม่สำเร็จ กรุณารีเฟรชหน้า');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}
function lazadaParseDate(value) {
  const text = lazadaText(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const en = text.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!en) return '';
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(en[2]);
  return month < 0 ? '' : `${en[3]}-${String(month + 1).padStart(2,'0')}-${en[1].padStart(2,'0')}`;
}
function lazadaParseOrderRow(row) {
  const orderItemId = lazadaText(row.orderItemId);
  const orderId = lazadaText(row.orderNumber);
  if (!orderItemId || !orderId) return null;
  return { orderItemId, orderId, orderDate:lazadaParseDate(row.createTime), sellerSku:lazadaText(row.sellerSku),
    lazadaSku:lazadaText(row.lazadaSku), name:lazadaText(row.itemName), variation:lazadaText(row.variation),
    status:lazadaText(row.status), unitPrice:lazadaMoney(row.unitPrice), paidPrice:lazadaMoney(row.paidPrice),
    sellerDiscount:lazadaMoney(row.sellerDiscountTotal), platformDiscount:lazadaMoney(row.platformDiscountTotal),
    shippingFee:lazadaMoney(row.shippingFee), hasOrder:true, transactions:[] };
}
function lazadaParseIncomeRow(row) {
  const orderItemId = lazadaText(row['รหัสสินค้าในคำสั่งซื้อ']);
  const orderId = lazadaText(row['หมายเลขคำสั่งซื้อ']);
  if (!orderItemId || !orderId) return null;
  const item = { orderItemId, orderId, orderDate:lazadaParseDate(row['วันที่สร้างคำสั่งซื้อ']),
    sellerSku:lazadaText(row['SKU ร้านค้า']), lazadaSku:lazadaText(row['Lazada SKU']),
    name:lazadaText(row['ชื่อสินค้า']), variation:'', status:lazadaText(row['สถานะคำสั่งซื้อ']),
    unitPrice:0, paidPrice:0, sellerDiscount:0, platformDiscount:0, shippingFee:0, hasOrder:false,
    transactions:[{ date:lazadaParseDate(row['วันที่ทำรายการ']), type:lazadaText(row['ชื่อรายการธุรกรรม']),
      amount:lazadaMoney(row['จำนวนเงิน(รวมภาษี)']), vat:lazadaMoney(row['VAT Amount']),
      wht:lazadaMoney(row['WHT Amount']), statement:lazadaText(row['รหัสรอบบิล']) }] };
  return item;
}
async function lazadaUploadFiles(input) {
  const files = [...(input.files || [])]; if (!files.length) return;
  try {
    let next = _lazadaItems;
    let orderCount = 0, financeCount = 0;
    for (const file of files) {
      const rows = lazadaSheetRows(file, await file.arrayBuffer());
      if (!rows.length) throw new Error(`${file.name}: ไม่พบรายการ`);
      if ('orderItemId' in rows[0] && 'orderNumber' in rows[0]) {
        const parsed = rows.map(lazadaParseOrderRow).filter(Boolean);
        if (!parsed.length) throw new Error(`${file.name}: ไม่พบเลขออเดอร์/รายการสินค้า`);
        orderCount += parsed.length; next = lazadaMergeItems(next, parsed);
      } else if ('รหัสสินค้าในคำสั่งซื้อ' in rows[0] && 'ชื่อรายการธุรกรรม' in rows[0]) {
        const parsed = rows.map(lazadaParseIncomeRow).filter(Boolean);
        if (!parsed.length) throw new Error(`${file.name}: ไม่พบรายการการเงิน`);
        financeCount += parsed.length; next = lazadaMergeItems(next, parsed);
      } else throw new Error(`${file.name}: รูปแบบไฟล์ไม่ใช่ Order หรือ Income Overview ของ Lazada`);
    }
    _lazadaItems = next; lazadaBuildIndex();
    try { sessionStorage.setItem('lazada_summary_items_cache:' + currentShop?.id, JSON.stringify(_lazadaItems)); }
    catch (_) { toast('ข้อมูลใหญ่เกินพื้นที่เบราว์เซอร์ กรุณากดซิงค์ขึ้นเซิร์ฟเวอร์ทันที','error'); }
    lazadaRender();
    toast(`อ่านไฟล์แล้ว: ออเดอร์ ${orderCount} แถว · ธุรกรรม ${financeCount} แถว · รวม ${_lazadaItems.length} รายการสินค้า (ยังไม่ซิงค์เซิร์ฟเวอร์)`, 'success');
  } catch (error) { console.error('Lazada import failed:', error); toast('นำเข้า Lazada ไม่สำเร็จ: '+error.message,'error'); }
  finally { input.value=''; }
}
async function lazadaSyncServer() {
  const button=document.getElementById('lazada-sync-btn');
  if(button){button.disabled=true;button.textContent='⏳ กำลังซิงค์...';}
  try {
    if(!sb || !currentShop?.id || !currentUser?.id) throw new Error('กรุณาเข้าสู่ระบบและเลือกร้าน');
    if(!_lazadaItems.length) throw new Error('ยังไม่มีข้อมูล Lazada');
    let synced=0;
    for(let i=0;i<_lazadaItems.length;i+=100){
      const batch=_lazadaItems.slice(i,i+100).map(item=>({shop_id:currentShop.id,order_item_id:item.orderItemId,order_id:item.orderId,payload:item}));
      const {data,error}=await sb.from('lazada_summary_items').upsert(batch,{onConflict:'shop_id,order_item_id'}).select('order_item_id');
      if(error) throw error;
      if(!data || data.length!==batch.length) throw new Error('เซิร์ฟเวอร์ยืนยันรายการไม่ครบ');
      data.forEach(row=>_lazadaServerItemIds.add(row.order_item_id));synced+=data.length;
    }
    _lazadaSource='server';
    sessionStorage.removeItem('lazada_summary_items_cache:' + currentShop.id);
    lazadaRender();toast(`ซิงค์ Lazada สำเร็จ ${synced} รายการสินค้า ✓`,'success');
  } catch(error){
    console.error('Lazada sync failed:',error);
    const missing=/lazada_summary_items.*(schema cache|does not exist)/i.test(error.message||'') || error.code==='PGRST205';
    toast(missing?'ยังไม่ได้ติดตั้งตาราง Lazada กรุณารัน supabase_lazada_sync_v298.sql ใน Supabase SQL Editor':'ซิงค์ Lazada ไม่สำเร็จ: '+error.message,'error');
  } finally {if(button){button.disabled=false;button.textContent='☁️ ซิงค์ขึ้นเซิร์ฟเวอร์';}}
}
function lazadaExportCSV() {
  const headings=['order_id','order_item_id','order_date','seller_sku','product','unit_price','item_price_credit','net_after_adjustments','cost_estimate','profit_estimate','server_synced'];
  const csv=[headings,...lazadaVisibleItems().map(item=>{const f=lazadaItemFinancial(item);return [item.orderId,item.orderItemId,item.orderDate,item.sellerSku,item.name,item.unitPrice,f.sale,f.payout,f.cost,f.profit,_lazadaServerItemIds.has(item.orderItemId)?'yes':'no']})]
    .map(row=>row.map(value=>'"'+String(value??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='lazada_summary_'+(_lazadaPeriod==='all'?'all':_lazadaPeriod)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function lazadaReconciliationBadge(order) {
  const recon=getOrderLazadaReconciliation(order);if(recon.status==='other')return '';
  const labels={matched:'เชื่อม Lazada แล้ว',missing_ref:'ไม่มีเลขอ้างอิง Lazada',loading:'กำลังโหลด Lazada',unverified:'ตรวจเลขซ้ำไม่ได้',duplicate:'เลขอ้างอิงซ้ำ',not_found:'ไม่พบใน Lazada Summary',pending_finance:'รอรายรับ Lazada',local_only:'ยังไม่ซิงค์ Lazada'};
  const diff=recon.status==='matched' && Math.abs(Number(order.total_amount||0)-recon.match.sale)>0.01;
  return `<span class="badge" role="button" tabindex="0" data-order-id="${lazadaSafe(order.id)}" onclick="event.stopPropagation();openLazadaOrderDrilldown(this.dataset.orderId)" onkeydown="if(event.key==='Enter'||event.key===' '){event.stopPropagation();openLazadaOrderDrilldown(this.dataset.orderId)}" style="cursor:pointer;background:${recon.status==='matched'&&!diff?'#dcfce7':'#fff7ed'};color:${recon.status==='matched'&&!diff?'#15803d':'#c2410c'};font-size:10px;margin-top:3px" title="กดดูข้อมูล Lazada · ${lazadaSafe(recon.ref||'')}">${recon.status==='matched'&&!diff?'✅':'⚠️'} ${diff?'เชื่อมแล้ว · ยอดขายต่าง':labels[recon.status]} 🔎</span>`;
}
function lazadaSaleDifferenceLine(order) {
  if(isOrderCancelled(order))return '';
  const recon=getOrderLazadaReconciliation(order);if(recon.status!=='matched')return '';
  if(Math.abs(Number(order.total_amount||0)-recon.match.sale)<=0.01)return '';
  return `<div style="font-size:11px;color:#c2410c;font-weight:700">ขาย Lazada <span class="font-mono">${fmtB(recon.match.sale)}</span></div>`;
}
function renderOrderLazadaReconciliation(order,cost) {
  const recon=getOrderLazadaReconciliation(order);if(recon.status==='other')return '';
  if(recon.status!=='matched')return `<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:9px;padding:10px;margin:10px 0;font-size:12px;color:#9a3412">⚠️ Lazada: ${lazadaSafe(recon.ref||'ยังไม่มีเลขอ้างอิง')} · ${lazadaSafe({missing_ref:'กรอกเลขอ้างอิงเอกสารให้ตรงกับหมายเลขคำสั่งซื้อ Lazada',loading:'กำลังโหลดข้อมูล',unverified:'ยังตรวจความซ้ำเลขอ้างอิงไม่ได้',duplicate:'เลขอ้างอิงซ้ำในระบบ',not_found:'ไม่พบในรายงาน Lazada',pending_finance:'มีออเดอร์แต่ยังไม่มีรายการรับเงินจริง',local_only:'มีข้อมูลในเครื่อง แต่ยังไม่ซิงค์ขึ้นเซิร์ฟเวอร์'}[recon.status]||recon.status)}</div>`;
  const m=recon.match;const delta=lazadaMoney(Number(order.total_amount||0)-m.sale);const profit=lazadaMoney(m.payout-Number(cost||0));
  const body=m.items.map(item=>{const f=lazadaItemFinancial(item);const product=lazadaProductFor(item);const local=(order.order_items||[]).find(x=>x.product_id===product?.id || (item.sellerSku && lazadaText(x.sku).toUpperCase()===item.sellerSku.toUpperCase()));const localPrice=local?Number(local.sell_price||0):null;return `<tr><td>${lazadaSafe(item.name)}${item.variation?' · '+lazadaSafe(item.variation):''}<div class="font-mono">${lazadaSafe(item.sellerSku)}</div></td><td class="text-right">${fmtB(item.unitPrice)}</td><td class="text-right">${localPrice===null?'<span style="color:#c2410c">ไม่พบคู่</span>':fmtB(localPrice)}</td><td class="text-right">${fmtB(f.sale)}</td><td class="text-right">${fmtB(f.deductions)}</td><td class="text-right">${fmtB(f.payout)}</td></tr>`}).join('');
  return `<div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:9px;padding:12px;margin:12px 0;font-size:12px"><b>🔗 เทียบ Lazada Summary · ${lazadaSafe(recon.ref)}</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:9px 0"><div>ขายในออเดอร์<br><b>${fmtB(order.total_amount)}</b></div><div>ขายจริง Lazada<br><b>${fmtB(m.sale)}</b></div><div>หัก/ปรับปรุงจริง<br><b>${fmtB(m.fee)}</b></div><div>หลังหัก<br><b>${fmtB(m.payout)}</b></div><div>ต้นทุนออเดอร์<br><b>${fmtB(cost)}</b></div><div>กำไรตาม Lazada<br><b>${fmtB(profit)}</b></div></div><div style="color:${Math.abs(delta)>0.01?'#c2410c':'#15803d'}">${Math.abs(delta)>0.01?'⚠️ ยอดขายต่าง '+fmtB(delta)+' (ออเดอร์ − Lazada)':'✅ ยอดขายรวมตรงกัน'}</div>${lazadaTable(['สินค้า / SKU','ราคาขาย Lazada','ราคาขายในระบบ','ยอดค่าสินค้า','หัก/ปรับปรุง','หลังหัก'],body)}<div style="font-size:11px;color:#64748b;margin-top:6px">รายการหัก/ปรับปรุงรวมค่าธรรมเนียม ส่วนลด คืนเงิน และปรับปรุงภายหลัง · ราคาขาย Lazada ไม่รวมค่าส่ง · ต้นทุนใช้ค่าที่บันทึกในออเดอร์ระบบ</div></div>`;
}
async function openLazadaOrderDrilldown(orderId) {
  document.getElementById('modal-lazada-order-drilldown')?.remove();
  const overlay=document.createElement('div');overlay.id='modal-lazada-order-drilldown';overlay.className='modal-overlay open';overlay.style.zIndex=getNextModalZIndex();
  overlay.innerHTML='<div class="modal" style="max-width:1050px;width:100%;max-height:90vh;overflow:auto"><div class="modal-title">🛍️ รายละเอียดออเดอร์ Lazada</div><div id="lazada-order-drilldown-content" class="loading"><div class="spinner"></div></div></div>';
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.body.appendChild(overlay);ensureModalCloseButton(overlay,()=>overlay.remove());
  try {
    await ensureLazadaSummary();
    const {data,error}=await sb.from('orders').select('*,order_items(*)').eq('shop_id',currentShop.id).eq('id',orderId).single();
    if(error)throw error;
    const cost=Number(data.total_cost)>0?Number(data.total_cost):orderCostWithFallback(data);
    document.getElementById('lazada-order-drilldown-content').innerHTML=`<div style="font-size:12px">ออเดอร์ระบบ ${lazadaSafe(data.order_no)} · เลข Lazada ${lazadaSafe(data.customer_social||data.platform_order_id)}</div>${renderOrderLazadaReconciliation(data,cost)}<div style="text-align:right"><button class="btn btn-secondary btn-sm" data-order-id="${lazadaSafe(data.id)}" onclick="document.getElementById('modal-lazada-order-drilldown').remove();viewOrder(this.dataset.orderId)">เปิดออเดอร์ในระบบ</button> <button class="btn btn-secondary btn-sm" onclick="document.getElementById('modal-lazada-order-drilldown').remove()">ปิด</button></div>`;
  } catch(error){document.getElementById('lazada-order-drilldown-content').textContent='โหลด Lazada ไม่สำเร็จ: '+error.message;}
}

window.lazadaSummary=lazadaSummary;
