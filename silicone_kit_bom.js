// BOM metadata is stored on the kit product so it travels with the product record.
// Purchased boxes are unpacked into component stock with an audited movement.
// A saleable complete box can also be assembled virtually from on-hand parts;
// that virtual quantity is never posted again as physical inventory.
function getProductBom(product) {
  const note = String(product?.application_note || '');
  const match = note.match(/\[\[BOM64:([A-Za-z0-9+/=]+)\]\]/);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), char => char.charCodeAt(0));
    const bom = JSON.parse(new TextDecoder().decode(bytes));
    if (bom.version !== 1 || !Array.isArray(bom.components)) return null;
    return bom;
  } catch (error) {
    console.warn('Invalid product BOM', product?.sku, error);
    return null;
  }
}

function getBomVirtualBoxCount(product, products) {
  const bom = getProductBom(product);
  if (!bom?.components?.length) return 0;
  const bySku = new Map((products || []).map(p => [String(p.sku || '').trim(), p]));
  let boxes = Infinity;
  for (const component of bom.components) {
    const perBox = Number(component.qty || 0);
    const part = bySku.get(String(component.sku || '').trim());
    if (!part || !Number.isInteger(perBox) || perBox <= 0) return 0;
    boxes = Math.min(boxes, Math.floor(Math.max(0, Number(part.stock_qty || 0)) / perBox));
  }
  return Number.isFinite(boxes) ? Math.max(0, boxes) : 0;
}

async function unpackExistingBomReceipts(kitId = null) {
  if (!sb || !currentShop?.id) return;
  const {data:kits,error:kitError} = await sb.from('products')
    .select('id,sku,name,stock_qty,application_note').eq('shop_id',currentShop.id)
    .like('sku','ST-ORS-W-KIT-%');
  if (kitError) { toast('โหลดชุด BOM ไม่สำเร็จ: '+kitError.message,'error'); return; }
  const targets = (kits||[]).filter(p => getProductBom(p) && (!kitId || p.id===kitId) && Number(p.stock_qty)>0);
  if (!targets.length) { toast('ไม่มีกล่อง BOM ที่ต้องแปลงเป็นรายตัว','info'); return; }
  const ids = targets.map(p => p.id);
  const [{data:moves,error:moveError},{data:audits,error:auditError}] = await Promise.all([
    sb.from('stock_movements').select('id,product_id,qty,note,move_date')
      .eq('shop_id',currentShop.id).eq('move_type','in').in('product_id',ids).like('note','GR|%').order('move_date',{ascending:false}).limit(500),
    sb.from('bom_unpack_audit').select('source_movement_id').eq('shop_id',currentShop.id).limit(1000)
  ]);
  if (moveError || auditError) {
    toast('โหลดรายการแปลง BOM ไม่สำเร็จ: '+(moveError||auditError).message+
      (auditError?' · กรุณารัน supabase_bom_unpack_v4142.sql ก่อน':''),'error');
    return;
  }
  const done = new Set((audits||[]).map(a => a.source_movement_id));
  const remaining = new Map(targets.map(p => [p.id,Number(p.stock_qty)]));
  const candidates = (moves||[]).filter(m => {
    if (done.has(m.id) || !(Number(m.qty)>0) || Number(m.qty)>Number(remaining.get(m.product_id)||0)) return false;
    remaining.set(m.product_id,Number(remaining.get(m.product_id))-Number(m.qty));
    return true;
  });
  if (!candidates.length) { toast('ไม่พบรายการรับเข้ากล่องที่แปลงได้ กรุณาตรวจสต๊อกก่อน','error'); return; }
  const boxCount = candidates.reduce((sum,m)=>sum+Number(m.qty),0);
  if (!confirm('แปลง '+boxCount+' กล่องจาก '+candidates.length+' รายการรับเข้าเป็นโอริงรายตัวตาม BOM?\n'+
    'ระบบจะตัดยอดกล่องกายภาพและเพิ่ม SKU ชิ้นส่วนโดยเก็บประวัติการแปลง ต้นทุนรวมและจำนวนใน PO ไม่เปลี่ยน')) return;
  const affected = new Set();
  let converted = 0;
  try {
    for (const move of candidates) {
      const {data,error} = await sb.rpc('unpack_bom_receipt',{
        p_source_movement_id:move.id,p_expected_qty:Number(move.qty)
      });
      if (error) throw error;
      if (data?.already_unpacked) continue;
      converted++;
      affected.add(move.product_id);
      (data?.components||[]).forEach(c => { if (c.product_id) affected.add(c.product_id); });
    }
  } catch(error) {
    toast('แปลง BOM ได้ '+converted+' รายการแล้ว แต่รายการถัดไปไม่สำเร็จ: '+error.message+
      ' · ตรวจประวัติก่อนกดซ้ำ','error');
  }
  if (affected.size) {
    await recalcStockQty([...affected]);
    if (typeof loadProducts==='function' && currentPage==='products') await loadProducts();
    if (typeof loadStockHistory==='function' && currentPage==='stock') await loadStockHistory();
    toast('แปลง BOM เป็นรายตัวสำเร็จ '+converted+' รายการ ✓','success');
  }
  openSiliconeKitBom(kitId);
}

async function openSiliconeKitBom(kitId = null) {
  if (!sb || !currentShop?.id) {
    toast('กรุณาเข้าสู่ระบบก่อนดู BOM', 'error');
    return;
  }
  const { data, error } = await sb.from('products')
    .select('id,sku,name,category,sell_price,purchase_price,current_cost,stock_qty,application_note,active')
    .eq('shop_id', currentShop.id)
    .like('sku', 'ST-ORS-W-KIT-%')
    .order('sku');
  if (error) {
    toast('โหลด BOM ไม่สำเร็จ: ' + error.message, 'error');
    return;
  }
  const {data:partProducts,error:partsError} = await sb.from('products')
    .select('sku,stock_qty').eq('shop_id',currentShop.id).like('sku','ST-ORS-W-%').limit(500);
  if (partsError) { toast('โหลดสต๊อกชิ้นส่วน BOM ไม่สำเร็จ: '+partsError.message,'error'); return; }
  const kits = (data || []).map(product => ({ product, bom: getProductBom(product) }))
    .filter(entry => entry.bom);
  if (!kitId) {
    const cards = kits.map(({ product, bom }) => {
      const pieces = bom.components.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      return `<button type="button" onclick="openSiliconeKitBom('${product.id}')" style="display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;color:var(--text)">
        <strong style="display:block;font-size:13px">${escapeHTML(product.name)}</strong>
        <span style="display:block;color:var(--text3);font-size:11px;margin-top:3px">${escapeHTML(product.sku)} · ${bom.components.length} ขนาด · ${pieces} ตัว/กล่อง</span>
        <span style="display:block;font-size:12px;margin-top:6px">ขาย ${fmtB(product.sell_price)} · กล่องจริง ${Number(product.stock_qty || 0)} · จัดชุดได้จากชิ้นส่วน ${getBomVirtualBoxCount(product,partProducts)} กล่อง</span>
      </button>`;
    }).join('');
    showDynamicModal('BOM ชุด O-Ring Silicone',
      `<p style="font-size:12px;color:var(--text3);margin:0 0 12px">กล่องที่รับเข้าจะแปลงเป็นสต๊อกรายตัว กล่องพร้อมขายจากชิ้นส่วนเป็นยอดเสมือนที่ใช้ชิ้นส่วนร่วมกัน ไม่บวกเป็นสต๊อกกายภาพซ้ำ</p>
       <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;max-height:62vh;overflow:auto">${cards || '<p>ยังไม่มีชุด BOM</p>'}</div>`,
      `<button class="btn btn-secondary" onclick="closeModal('modal-dynamic')">ปิด</button><button class="btn btn-primary" onclick="unpackExistingBomReceipts()">📦 แปลงกล่องคงเหลือเป็นรายตัว</button>`);
    return;
  }
  const selected = kits.find(entry => entry.product.id === kitId);
  if (!selected) {
    toast('ไม่พบ BOM ของสินค้าชุดนี้', 'error');
    return;
  }
  const { product, bom } = selected;
  const totalPcs = bom.components.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const rows = bom.components.map((item, index) => `<tr>
    <td style="padding:7px 8px;border-bottom:1px solid var(--border);font-size:11px">${index + 1}</td>
    <td style="padding:7px 8px;border-bottom:1px solid var(--border)"><strong>${escapeHTML(item.name || item.sku)}</strong><br><small style="color:var(--text3)">${escapeHTML(item.sku)}</small></td>
    <td style="padding:7px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono)">${Number(item.qty || 0)}</td>
    <td style="padding:7px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:var(--mono)">${fmtB(item.reference_unit_price || 0)}</td>
  </tr>`).join('');
  const note = bom.confirmed_duplicate
    ? '<p style="font-size:11px;color:#92400e;background:#fffbeb;padding:8px;border-radius:7px">15×2.4 mm จำนวน 40 ตัวต่อกล่อง ตามจำนวนที่ยืนยันสำหรับการนำเข้า</p>'
    : '';
  showDynamicModal('ส่วนประกอบชุด O-Ring Silicone',
    `<div style="font-size:13px;margin-bottom:10px"><strong>${escapeHTML(product.name)}</strong><br><span style="color:var(--text3)">${escapeHTML(product.sku)}</span></div>
     <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:12px">
       <span class="badge badge-gray">${bom.components.length} ขนาด</span><span class="badge badge-gray">${totalPcs} ตัว/กล่อง</span>
       <span class="badge badge-gray">กล่องจริง ${Number(product.stock_qty || 0)}</span>
       <span class="badge badge-green">จัดชุดได้จากชิ้นส่วน ${getBomVirtualBoxCount(product,partProducts)} กล่อง</span>
       <span class="badge badge-gray">ขาย ${fmtB(product.sell_price)}</span>
       <span class="badge badge-gray">ต้นทุนอ้างอิง ${fmtB(bom.reference_kit_cost)}</span>
     </div>${note}
     <div class="table-wrap" style="max-height:52vh;overflow:auto"><table style="width:100%;min-width:460px;border-collapse:collapse">
       <thead><tr><th>#</th><th>โอริงในกล่อง</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ราคาแยก/ตัว</th></tr></thead>
       <tbody>${rows}</tbody><tfoot><tr><th colspan="2" style="text-align:left">รวม</th><th style="text-align:right">${totalPcs}</th><th></th></tr></tfoot>
     </table></div>
     <p style="font-size:11px;color:var(--text3);margin:10px 0 0">ราคาแยกชิ้นมาจากไฟล์ Pricing v2; กล่องพร้อมขายจากชิ้นส่วนเป็นยอดเสมือนและแชร์ชิ้นส่วนกับ BOM ชุดอื่น</p>`,
    `<button class="btn btn-secondary" onclick="openSiliconeKitBom()">กลับไปรายการชุด</button><button class="btn btn-secondary" onclick="unpackExistingBomReceipts('${product.id}')">📦 แปลงกล่องนี้เป็นรายตัว</button><button class="btn btn-primary" onclick="closeModal('modal-dynamic')">ปิด</button>`);
}
