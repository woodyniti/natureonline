// BOM metadata is stored on the kit product so it travels with the product record.
// A purchased kit is stocked as one box; component stock changes only through a
// separate receipt or an explicit future unpacking transaction.
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
  const kits = (data || []).map(product => ({ product, bom: getProductBom(product) }))
    .filter(entry => entry.bom);
  if (!kitId) {
    const cards = kits.map(({ product, bom }) => {
      const pieces = bom.components.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      return `<button type="button" onclick="openSiliconeKitBom('${product.id}')" style="display:block;width:100%;text-align:left;background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;color:var(--text)">
        <strong style="display:block;font-size:13px">${escapeHTML(product.name)}</strong>
        <span style="display:block;color:var(--text3);font-size:11px;margin-top:3px">${escapeHTML(product.sku)} · ${bom.components.length} ขนาด · ${pieces} ตัว/กล่อง</span>
        <span style="display:block;font-size:12px;margin-top:6px">ขาย ${fmtB(product.sell_price)} · สต็อก ${Number(product.stock_qty || 0)} กล่อง</span>
      </button>`;
    }).join('');
    showDynamicModal('BOM ชุด O-Ring Silicone',
      `<p style="font-size:12px;color:var(--text3);margin:0 0 12px">รับเข้าสต็อกเป็นกล่องสำเร็จจากผู้ขาย รายการโอริงด้านในใช้ตรวจส่วนประกอบและราคาแยกชิ้น</p>
       <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;max-height:62vh;overflow:auto">${cards || '<p>ยังไม่มีชุด BOM</p>'}</div>`,
      `<button class="btn btn-secondary" onclick="closeModal('modal-dynamic')">ปิด</button>`);
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
       <span class="badge badge-gray">คงเหลือ ${Number(product.stock_qty || 0)} กล่อง</span>
       <span class="badge badge-gray">ขาย ${fmtB(product.sell_price)}</span>
       <span class="badge badge-gray">ต้นทุนอ้างอิง ${fmtB(bom.reference_kit_cost)}</span>
     </div>${note}
     <div class="table-wrap" style="max-height:52vh;overflow:auto"><table style="width:100%;min-width:460px;border-collapse:collapse">
       <thead><tr><th>#</th><th>โอริงในกล่อง</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ราคาแยก/ตัว</th></tr></thead>
       <tbody>${rows}</tbody><tfoot><tr><th colspan="2" style="text-align:left">รวม</th><th style="text-align:right">${totalPcs}</th><th></th></tr></tfoot>
     </table></div>
     <p style="font-size:11px;color:var(--text3);margin:10px 0 0">ราคาแยกชิ้นมาจากไฟล์ Pricing v2 ต้นทุนอ้างอิงไม่ใช่ต้นทุนสต็อกจริง สต็อกโอริงย่อยไม่เพิ่มเมื่อรับกล่อง</p>`,
    `<button class="btn btn-secondary" onclick="openSiliconeKitBom()">กลับไปรายการชุด</button><button class="btn btn-primary" onclick="closeModal('modal-dynamic')">ปิด</button>`);
}
