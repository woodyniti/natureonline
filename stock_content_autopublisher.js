const crypto = require('crypto');

const HOUR_MS = 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;
const ANGLES = [
  { heading: 'ข้อมูลสินค้าและวิธีเลือกให้ตรงรุ่น', intro: 'เริ่มจากตรวจชื่อรุ่น รหัส และขนาดของอะไหล่เดิมก่อนเลือกซื้อ' },
  { heading: 'เช็กรหัสและขนาดก่อนสั่งซื้อ', intro: 'การเทียบรหัสและขนาดกับชิ้นงานจริงช่วยลดโอกาสสั่งสินค้าผิดรุ่น' },
  { heading: 'คู่มือตรวจสอบสินค้าสำหรับงานซ่อม', intro: 'เตรียมข้อมูลรุ่น วัสดุ และรูปอะไหล่เดิมให้ครบก่อนสอบถามสินค้า' },
  { heading: 'คำถามที่ควรถามก่อนเลือกสินค้า', intro: 'ตรวจสอบความเหมาะสมกับงานจริงและยืนยันสต๊อกล่าสุดก่อนสั่งซื้อ' }
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function slugForSku(sku) {
  const readable = String(sku).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55) || 'item';
  return `stock-${readable}-${crypto.createHash('sha256').update(String(sku)).digest('hex').slice(0, 10)}`;
}

function buildStockContent(product, cycle = 0) {
  const name = String(product.name || '').trim();
  const sku = String(product.sku || '').trim();
  if (!name || !sku || Number(product.stock_qty || 0) <= 0) throw new Error('SKU, name and positive stock are required');
  const angle = ANGLES[cycle % ANGLES.length];
  const stock = Number(product.stock_qty);
  const price = Number(product.sell_price || 0);
  const description = String(product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const category = String(product.category_name || (typeof product.category === 'string' ? product.category : '')).trim();
  const imageUrl = /^https:\/\/[^\s"'<>]+$/i.test(String(product.image_url || '')) ? String(product.image_url) : '';
  const specs = [
    ['วัสดุ', product.material],
    ['ประเภทซีล', product.seal_type],
    ['ขนาดรูใน (ID)', product.inner_diameter],
    ['ขนาดโตนอก (OD)', product.outer_diameter],
    ['ความหนา/หน้าตัด', product.width]
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '');
  const indexable = description.length >= 40 || specs.length >= 2;
  const title = `${name} | ${angle.heading} | SEALTHAI`;
  const excerpt = `ข้อมูล ${name} รหัส ${sku} สต๊อก ${stock} ชิ้น พร้อมแนวทางตรวจสอบขนาดและติดต่อ SEALTHAI`.slice(0, 155);
  const list = specs.length
    ? `<h2>ข้อมูลจำเพาะจากทะเบียนสินค้า</h2><ul>${specs.map(([key, val]) => `<li><strong>${escapeHtml(key)}:</strong> ${escapeHtml(val)}</li>`).join('')}</ul>`
    : '<p>หากต้องการสเปกวัสดุหรือขนาดเพิ่มเติม กรุณาสอบถามพร้อมแจ้งรหัสสินค้า</p>';
  const content = `<article style="max-width:820px;margin:auto;font-family:Arial,sans-serif;line-height:1.75;color:#172033">
<header style="padding:28px;background:#f0fdfa;border-radius:16px"><p style="color:#0f766e;font-weight:700">SEALTHAI · สินค้าในสต๊อก</p><h1>${escapeHtml(name)}</h1><p>SKU ${escapeHtml(sku)}${category ? ` · ${escapeHtml(category)}` : ''}</p></header>
${imageUrl ? `<figure style="text-align:center"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" loading="lazy" style="max-width:100%;height:auto;border-radius:12px"></figure>` : ''}
<section><h2>${escapeHtml(angle.heading)}</h2><p><strong>${escapeHtml(name)}</strong> คือสินค้ารหัส ${escapeHtml(sku)} ที่ SEALTHAI มีในทะเบียนสินค้า ${escapeHtml(angle.intro)}</p>
${description ? `<p>${escapeHtml(description)}</p>` : ''}
${list}</section>
<section><h2>เช็กข้อมูลก่อนสั่ง</h2><ol><li>เทียบรหัส SKU และขนาดกับอะไหล่เดิมหรือแบบเครื่องจักร</li><li>ยืนยันวัสดุและลักษณะงานที่ใช้จริง</li><li>สอบถามสต๊อกและราคาล่าสุดก่อนชำระเงิน</li></ol></section>
<section style="padding:22px;background:#ecfeff;border-radius:14px"><h2>ราคาและสต๊อก</h2><p>สต๊อก ณ เวลาสร้างเนื้อหา: ${stock} ชิ้น${price > 0 ? ` · ราคาในระบบ ฿${price.toFixed(2)} ต่อชิ้น` : ''} (อาจเปลี่ยนแปลงได้)</p><a href="https://lin.ee/sealthai" style="display:inline-block;padding:11px 20px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">สอบถาม SEALTHAI ทาง LINE</a></section>
<section><h2>คำถามที่พบบ่อย</h2><h3>สั่ง ${escapeHtml(name)} ต้องแจ้งอะไร?</h3><p>แจ้งรหัส ${escapeHtml(sku)} ขนาด วัสดุ และรูปชิ้นงานเดิม (ถ้ามี)</p><h3>มีสินค้าในสต๊อกหรือไม่?</h3><p>ข้อมูลล่าสุดที่ใช้สร้างหน้านี้คือ ${stock} ชิ้น โปรดยืนยันจำนวนอีกครั้งก่อนสั่งซื้อ</p></section>
</article>`;
  const facebook = `📦 ${name}\nSKU: ${sku}\nสต๊อกในระบบ: ${stock} ชิ้น${price > 0 ? ` · ราคา ฿${price.toFixed(2)}` : ''}\n\n${angle.intro} แจ้ง SKU พร้อมรูปอะไหล่เดิมให้ทีม SEALTHAI ช่วยตรวจสอบได้\n\n💬 https://lin.ee/sealthai\n#SEALTHAI #ซีล #โอริง #อะไหล่`;
  return { sku, slug: slugForSku(sku), title, excerpt, content, facebook, imageUrl, cycle, indexable };
}

function chooseNextProduct(products, history) {
  const unique = new Map();
  products.filter(p => p && p.sku && p.name && Number(p.stock_qty || 0) > 0 && p.active !== false)
    .forEach(p => {
      const key = String(p.sku).trim().toLowerCase();
      const existing = unique.get(key);
      if (!existing || Number(p.stock_qty) > Number(existing.stock_qty)) unique.set(key, p);
    });
  const rows = [...unique.values()];
  rows.sort((a, b) => {
    const ah = history.get(String(a.id)) || {};
    const bh = history.get(String(b.id)) || {};
    return (Number(ah.cycle ?? -1) - Number(bh.cycle ?? -1))
      || String(ah.published_at || '').localeCompare(String(bh.published_at || ''))
      || String(a.sku).localeCompare(String(b.sku), 'th');
  });
  return rows[0] || null;
}

function sqliteRun(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  }));
}
function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || [])));
}

async function fetchInStockProducts(supabase, shopId) {
  const products = [];
  for (let from = 0; ; from += 500) {
    let query = supabase.from('products').select('*').gt('stock_qty', 0).order('id', { ascending: true }).range(from, from + 499);
    if (shopId) query = query.eq('shop_id', shopId);
    const { data, error } = await query;
    if (error) throw error;
    products.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return products;
}

function startStockContentScheduler({ supabase, db, axios, env, sendTelegramMessage }) {
  if (env.STOCK_CONTENT_ENABLED !== 'true') {
    console.log('[Stock Content] Disabled. Set STOCK_CONTENT_ENABLED=true after deployment.');
    return null;
  }
  const publishUrl = env.STOCK_CONTENT_PUBLISH_URL || 'https://sealthai.com/api-stock-content.php';
  const token = env.STOCK_CONTENT_PUBLISH_TOKEN || '';
  const chatId = env.TELEGRAM_ADMIN_CHAT_ID || '';
  const shopId = env.DEFAULT_SHOP_ID || '';
  if (!/^https:\/\//.test(publishUrl) || !token || !chatId || !env.TELEGRAM_BOT_TOKEN || !shopId || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Stock Content] Not started: HTTPS publisher, token, Telegram, shop ID and Supabase service key are required.');
    return null;
  }
  let running = false;
  let nextRetryAt = 0;
  const ready = sqliteRun(db, `CREATE TABLE IF NOT EXISTS stock_content_publications (
    product_id TEXT PRIMARY KEY, sku TEXT NOT NULL, cycle INTEGER NOT NULL, url TEXT NOT NULL,
    published_at TEXT NOT NULL, facebook TEXT NOT NULL, title TEXT NOT NULL
  )`);
  async function tick() {
    if (running || Date.now() < nextRetryAt) return;
    running = true;
    try {
      await ready;
      const last = await sqliteAll(db, 'SELECT MAX(published_at) AS published_at FROM stock_content_publications');
      const lastTime = Date.parse(last[0]?.published_at || '') || 0;
      if (Date.now() - lastTime < HOUR_MS) return;
      const products = await fetchInStockProducts(supabase, shopId);
      const historyRows = await sqliteAll(db, 'SELECT * FROM stock_content_publications');
      const history = new Map(historyRows.map(row => [String(row.product_id), row]));
      const product = chooseNextProduct(products, history);
      if (!product) {
        console.log('[Stock Content] No in-stock products with SKU and name.');
        nextRetryAt = Date.now() + HOUR_MS;
        return;
      }
      const previous = history.get(String(product.id));
      const cycle = Number(previous?.cycle ?? -1) + 1;
      const draft = buildStockContent(product, cycle);
      if (previous?.url && !previous.url.endsWith('/' + draft.slug + '.html')) {
        throw new Error('SKU changed for an existing product; canonical URL needs manual review');
      }
      const { data: fresh, error: freshError } = await supabase.from('products')
        .select('stock_qty').eq('id', product.id).single();
      if (freshError) throw freshError;
      if (Number(fresh?.stock_qty || 0) <= 0) throw new Error('Stock reached zero before publication');
      product.stock_qty = Number(fresh.stock_qty);
      const confirmedDraft = buildStockContent(product, cycle);
      const { data } = await axios.post(publishUrl, {
        sku: confirmedDraft.sku, slug: confirmedDraft.slug, title: confirmedDraft.title, excerpt: confirmedDraft.excerpt,
        content: confirmedDraft.content, facebook: confirmedDraft.facebook, imageUrl: confirmedDraft.imageUrl,
        indexable: confirmedDraft.indexable
      }, { headers: { Authorization: `Bearer ${token}` }, timeout: 30000 });
      const url = String(data?.url || '');
      const parsed = new URL(url);
      if (data?.success !== true || parsed.protocol !== 'https:' || !['sealthai.com', 'www.sealthai.com'].includes(parsed.hostname)) {
        throw new Error('Publisher did not confirm a valid sealthai.com article URL');
      }
      if (previous?.url && previous.url !== url) throw new Error('Publisher changed canonical URL for an existing SKU');
      const now = new Date().toISOString();
      await sqliteRun(db, `INSERT INTO stock_content_publications
        (product_id,sku,cycle,url,published_at,facebook,title) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(product_id) DO UPDATE SET sku=excluded.sku,cycle=excluded.cycle,url=excluded.url,
        published_at=excluded.published_at,facebook=excluded.facebook,title=excluded.title`,
        [String(product.id), confirmedDraft.sku, cycle, url, now, confirmedDraft.facebook, confirmedDraft.title]);
      const msg = `✅ <b>เผยแพร่สินค้าที่มีสต๊อกแล้ว</b>\nSKU: <code>${escapeHtml(confirmedDraft.sku)}</code> · รอบที่ ${cycle + 1}\n📦 คงเหลือ ${Number(product.stock_qty)} ชิ้น\n🔗 ${escapeHtml(url)}\n\n📘 <b>ข้อความ Facebook (คัดลอกได้):</b>\n${escapeHtml(confirmedDraft.facebook)}`;
      try { await sendTelegramMessage(chatId, msg); }
      catch (notifyError) { console.error('[Stock Content] Published but Telegram failed:', notifyError.message); }
      console.log(`[Stock Content] Published ${confirmedDraft.sku}, cycle ${cycle + 1}: ${url}`);
    } catch (err) {
      nextRetryAt = Date.now() + RETRY_MS;
      console.error('[Stock Content] Failed:', err.message);
    } finally {
      running = false;
    }
  }
  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  const firstRun = tick();
  return { tick, firstRun, stop: () => clearInterval(timer) };
}

module.exports = { buildStockContent, chooseNextProduct, slugForSku, startStockContentScheduler };
