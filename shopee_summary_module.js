// ══════════════════════════════════════════════════════════════
// ── SEALTHAI v2.74: Shopee Executive Summary & Planning Engine ──
// ══════════════════════════════════════════════════════════════

var _shopeeSummaryOrders = [];
var _shopeeSummaryTab = 'overview'; // 'overview', 'ads', 'stock', 'geo', 'buyers', 'linkage'
var _shopeeSummaryPeriod = 'all';   // 'all', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'
var _shopeeSummarySearch = '';
var _shopeeSummaryLinkFilter = 'all'; // 'all', 'linked', 'unmatched'
var _shopeeSummarySortBy = 'revenue'; // 'revenue', 'units', 'profit', 'margin', 'stock'
var _shopeeSummarySortDir = 'desc';
var _shopeeSummaryCharts = {};
var _shopeeSummaryMappings = [];
var _shopeeSummaryLoaded = false;

// ── Ads Filter & Sorting State ──
var _shopeeAdsFilter = 'high_buffer'; // 'high_buffer', 'should_run_ads', 'in_stock', 'top_stars', 'out_of_stock', 'all'
var _shopeeAdsSearch = '';
var _shopeeAdsSortBy = 'buffer'; // 'buffer' (breakevenROAS asc), 'marginPct', 'profit', 'units', 'dealPrice', 'stockQty', 'sku'
var _shopeeAdsSortDir = 'asc';

// ── Region Classifier ──
function getThaiRegion(prov) {
  if (!prov) return 'ไม่ระบุ';
  const p = prov.replace('จังหวัด', '').trim();
  const bkk = ['กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'นครปฐม'];
  const east = ['ชลบุรี', 'ระยอง', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว', 'จันทบุรี', 'ตราด', 'นครนายก'];
  const central = ['พระนครศรีอยุธยา', 'สระบุรี', 'ลพบุรี', 'สิงห์บุรี', 'อ่างทอง', 'ชัยนาท', 'สุพรรณบุรี', 'นครสวรรค์', 'อุทัยธานี', 'กาญจนบุรี', 'ราชบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์', 'สมุทรสงคราม'];
  const north = ['เชียงใหม่', 'เชียงราย', 'ลำปาง', 'ลำพูน', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์', 'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'กำแพงเพชร', 'เพชรบูรณ์'];
  const northeast = ['นครราชสีมา', 'ขอนแก่น', 'อุบลราชธานี', 'อุดรธานี', 'บุรีรัมย์', 'สุรินทร์', 'ศรีสะเกษ', 'ร้อยเอ็ด', 'สกลนคร', 'กาฬสินธุ์', 'มหาสารคาม', 'ชัยภูมิ', 'มุกดาหาร', 'ยโสธร', 'เลย', 'หนองคาย', 'หนองบัวลำภู', 'บึงกาฬ', 'อำนาจเจริญ', 'นครพนม'];
  const south = ['สงขลา', 'ภูเก็ต', 'สุราษฎร์ธานี', 'นครศรีธรรมราช', 'กระบี่', 'พังงา', 'ตรัง', 'พัทลุง', 'ชุมพร', 'ระนอง', 'สตูล', 'ปัตตานี', 'ยะลา', 'นราธิวาส'];

  if (bkk.includes(p)) return 'กรุงเทพฯ & ปริมณฑล';
  if (east.includes(p)) return 'ภาคตะวันออก (EEC)';
  if (central.includes(p)) return 'ภาคกลาง & ตะวันตก';
  if (north.includes(p)) return 'ภาคเหนือ';
  if (northeast.includes(p)) return 'ภาคอีสาน (ตะวันออกเฉียงเหนือ)';
  if (south.includes(p)) return 'ภาคใต้';
  return 'อื่นๆ / ไม่ระบุ';
}

// ── Dimensional Seal Key & Cache Builder for Shopee Matching ──
function _sealKeyHelper(str) {
  if (typeof _sealKey === 'function') {
    try {
      const res = _sealKey(str);
      if (res && res.mat) return res;
    } catch(e){}
  }
  if (!str) return null;
  const s = String(str).toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const dims = [m[1], m[2], m[3]].map(x => String(parseFloat(x))).join('x');
  let mat = '';
  if (/viton|fkm|(?:^|[^a-z])vi(?:[^a-z]|$)/.test(s)) mat = 'vi';
  else if (/nbr|(?:^|[^a-z])nb(?:[^a-z]|$)/.test(s)) mat = 'nb';
  else if (/pu|(?:^|[^a-z])pu(?:[^a-z]|$)/.test(s)) mat = 'pu';
  return { mat, dims, key: (mat || '?') + '|' + dims };
}

function buildShopeeProdMaps(prods) {
  if (!Array.isArray(prods) || !prods.length) return;
  const exactMap = window._shopeeProdMap || {};
  const normMap = window._shopeeProdMapNorm || {};

  prods.forEach(p => {
    [p.sku, p.supplier_sku, p.part_no].forEach(code => {
      if (code) {
        exactMap[String(code).toLowerCase().trim()] = p;
        const k = _sealKeyHelper(code);
        if (k && k.mat) normMap[k.key] = p;
      }
    });
    const kName = _sealKeyHelper(p.name);
    if (kName && kName.mat) normMap[kName.key] = p;
  });

  window._shopeeProdMap = exactMap;
  window._shopeeProdMapNorm = normMap;
}

// ── Match Shopee Item with DB Products ──
function findShopeeProductMatch(itemSku, itemName) {
  const prods = window.allProducts || [];
  const sLow = String(itemSku || '').toLowerCase().trim();
  const nLow = String(itemName || '').toLowerCase().trim();

  // Ensure map is built
  if (!window._shopeeProdMapNorm || Object.keys(window._shopeeProdMapNorm).length === 0) {
    buildShopeeProdMaps(prods);
  }

  // 1. Check user mapping in marketplace_sku_mappings table
  if (sLow && Array.isArray(_shopeeSummaryMappings)) {
    const userMap = _shopeeSummaryMappings.find(m => String(m.platform_sku || '').toLowerCase().trim() === sLow);
    if (userMap && userMap.product_id) {
      const p = prods.find(x => x.id === userMap.product_id);
      if (p) return { matched: true, product: p, via: 'user_mapping', mapping: userMap };
    }
  }

  // 2. Exact match in products (sku, supplier_sku, part_no)
  if (sLow) {
    const exactHit = prods.find(p =>
      (p.sku && p.sku.toLowerCase().trim() === sLow) ||
      (p.supplier_sku && p.supplier_sku.toLowerCase().trim() === sLow) ||
      (p.part_no && p.part_no.toLowerCase().trim() === sLow)
    );
    if (exactHit) return { matched: true, product: exactHit, via: 'exact_code' };
  }

  // 3. Fallback: matchShopeeProd using seal dimensions (_sealKey)
  if (typeof matchShopeeProd === 'function') {
    const sealHit = matchShopeeProd(itemSku, itemName);
    if (sealHit) return { matched: true, product: sealHit, via: 'seal_dimension' };
  }
  const normMap = window._shopeeProdMapNorm || {};
  for (const s of [itemSku, itemName]) {
    const k = _sealKeyHelper(s);
    if (k && k.mat && normMap[k.key]) {
      return { matched: true, product: normMap[k.key], via: 'seal_dimension' };
    }
  }

  // 4. Fallback search by normalized part number inside itemSku or itemName
  if (sLow.length >= 4) {
    const partialHit = prods.find(p =>
      (p.sku && p.sku.toLowerCase().trim().includes(sLow)) ||
      (p.supplier_sku && p.supplier_sku.toLowerCase().trim().includes(sLow))
    );
    if (partialHit) return { matched: true, product: partialHit, via: 'partial_code' };
  }

  return { matched: false, product: null, via: 'unmatched' };
}

// ── Main Entry Point Called by showPage('shopeeSummary') ──
async function shopeeSummary() {
  const topbar = document.getElementById('topbar-actions');
  if (topbar) {
    topbar.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="initShopeeSummary(true)" title="รีเฟรชข้อมูลจากระบบ">🔄 รีเฟรช</button>
      <label class="btn btn-secondary btn-sm" style="cursor:pointer;margin:0" title="อัปโหลดไฟล์ Excel / CSV คำสั่งซื้อ Shopee เพิ่มเติม">
        <span>📂 อัปโหลดไฟล์ Shopee</span>
        <input type="file" id="shopee-summary-file-inp" accept=".xlsx,.csv" style="display:none" onchange="uploadShopeeSummaryExcel(this)">
      </label>
      <button class="btn btn-secondary btn-sm" id="shopee-summary-sync-btn" onclick="syncShopeeSummaryToAI()" title="ส่งข้อมูลและบทสรุปไปยัง Database / AI Server" style="background:#e0f2fe;color:#0369a1;border-color:#bae6fd;font-weight:700">
        ☁️ ซิงค์เข้า AI Server
      </button>
      <button class="btn btn-secondary btn-sm" onclick="exportShopeeSummaryCSV()" title="ส่งออกรายงานเป็น CSV">📥 ส่งออก CSV</button>
    `;
  }

  await initShopeeSummary(false);
}

// ── Initialize Data ──
async function initShopeeSummary(forceReload = false) {
  const pageContent = document.getElementById('page-content');
  if (!_shopeeSummaryLoaded || forceReload) {
    if (pageContent) {
      pageContent.innerHTML = `
        <div style="text-align:center;padding:60px 20px">
          <div class="spinner" style="margin:0 auto 16px auto"></div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">กำลังโหลดและวิเคราะห์ข้อมูลยอดขาย Shopee...</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">เชื่อมโยงฐานข้อมูลสินค้า คำนวณกำไร และประมวลผลการจัดซื้อและการตลาด</div>
        </div>
      `;
    }
  }

  // 1. Load Orders Data
  if (!_shopeeSummaryOrders.length || forceReload) {
    try {
      if (window.SHOPEE_PRELOADED_ORDERS && Array.isArray(window.SHOPEE_PRELOADED_ORDERS) && window.SHOPEE_PRELOADED_ORDERS.length > 0) {
        _shopeeSummaryOrders = [...window.SHOPEE_PRELOADED_ORDERS];
      } else {
        const cached = localStorage.getItem('shopee_summary_orders_cache');
        if (cached) {
          _shopeeSummaryOrders = JSON.parse(cached);
        } else {
          const res = await fetch('shopee_orders_preloaded.json');
          if (res.ok) {
            _shopeeSummaryOrders = await res.json();
            try { localStorage.setItem('shopee_summary_orders_cache', JSON.stringify(_shopeeSummaryOrders)); } catch(e){}
          }
        }
      }
    } catch (e) {
      console.warn('Error loading preloaded Shopee orders:', e);
    }
  }

  // 2. Load fresh Products and Mappings from Supabase
  try {
    const [prodsRes, mapsRes] = await Promise.all([
      sb.from('products').select('id, name, sku, supplier_sku, part_no, stock_qty, current_cost, sell_price, active, min_safety_stock_qty, moq').eq('shop_id', currentShop.id),
      sb.from('marketplace_sku_mappings').select('*').eq('shop_id', currentShop.id).eq('channel', 'shopee')
    ]);
    if (prodsRes.data) {
      window.allProducts = prodsRes.data;
      buildShopeeProdMaps(prodsRes.data);
    }
    if (mapsRes.data) _shopeeSummaryMappings = mapsRes.data;
  } catch (e) {
    console.warn('Error fetching Supabase products or mappings:', e);
  }

  _shopeeSummaryLoaded = true;
  renderShopeeSummaryDashboard();
}

// ── Metrics Calculation Engine ──
function computeShopeeSummaryMetrics() {
  const rows = _shopeeSummaryOrders.filter(r => {
    if (_shopeeSummaryPeriod !== 'all') {
      if (!r.orderDate || !r.orderDate.startsWith(_shopeeSummaryPeriod)) return false;
    }
    if (_shopeeSummarySearch) {
      const q = _shopeeSummarySearch.toLowerCase();
      const txt = `${r.orderId} ${r.sku} ${r.parentSku} ${r.productName} ${r.buyer} ${r.province} ${r.payMethod} ${r.carrier}`.toLowerCase();
      if (!txt.includes(q)) return false;
    }
    return true;
  });

  const skuMap = {};
  const buyerMap = {};
  const provinceMap = {};
  const paymentMap = {};
  const carrierMap = {};
  const monthMap = {};
  const orderIds = new Set();

  let grossRevenue = 0;
  let totalFees = 0;
  let totalCommission = 0;
  let totalTxFee = 0;
  let totalServiceFee = 0;
  let totalUnits = 0;
  let totalProductCost = 0;

  rows.forEach(r => {
    orderIds.add(r.orderId);
    const qty = Number(r.qty) || 1;
    const rev = Number(r.netSale) > 0 ? Number(r.netSale) : (Number(r.dealPrice || 0) * qty);
    const com = Number(r.commission || 0);
    const tx = Number(r.txFee || 0);
    const srv = Number(r.serviceFee || 0);
    const fee = (com + tx + srv) || Number(r.totalFee || 0);

    grossRevenue += rev;
    totalFees += fee;
    totalCommission += com;
    totalTxFee += tx;
    totalServiceFee += srv;
    totalUnits += qty;

    const itemSku = String(r.sku || r.parentSku || r.productName || 'UNKNOWN').trim();
    if (!skuMap[itemSku]) {
      skuMap[itemSku] = {
        sku: itemSku,
        name: r.productName || itemSku,
        parentSku: r.parentSku || '',
        option: r.option || '',
        units: 0,
        orders: new Set(),
        revenue: 0,
        fees: 0,
        dealPrices: [],
        match: findShopeeProductMatch(itemSku, r.productName)
      };
    }
    skuMap[itemSku].units += qty;
    skuMap[itemSku].orders.add(r.orderId);
    skuMap[itemSku].revenue += rev;
    skuMap[itemSku].fees += fee;
    if (r.dealPrice > 0) skuMap[itemSku].dealPrices.push(Number(r.dealPrice));

    // Buyer aggregation
    const buyer = (r.buyer || 'ไม่ระบุ').trim();
    if (!buyerMap[buyer]) {
      buyerMap[buyer] = {
        buyer,
        orders: new Set(),
        units: 0,
        spent: 0,
        province: r.province || 'ไม่ระบุ',
        lastDate: r.orderDate || '',
        payMethods: {}
      };
    }
    buyerMap[buyer].orders.add(r.orderId);
    buyerMap[buyer].units += qty;
    buyerMap[buyer].spent += rev;
    if (r.orderDate && r.orderDate > buyerMap[buyer].lastDate) {
      buyerMap[buyer].lastDate = r.orderDate;
    }
    const pm = r.payMethod || 'ไม่ระบุ';
    buyerMap[buyer].payMethods[pm] = (buyerMap[buyer].payMethods[pm] || 0) + 1;

    // Province aggregation
    const prov = (r.province || 'ไม่ระบุ').replace('จังหวัด', '').trim();
    if (!provinceMap[prov]) {
      provinceMap[prov] = {
        province: prov,
        region: getThaiRegion(prov),
        orders: new Set(),
        units: 0,
        revenue: 0
      };
    }
    provinceMap[prov].orders.add(r.orderId);
    provinceMap[prov].units += qty;
    provinceMap[prov].revenue += rev;

    // Payment & Carrier
    paymentMap[pm] = (paymentMap[pm] || 0) + 1;
    const cr = r.carrier || 'ไม่ระบุ';
    carrierMap[cr] = (carrierMap[cr] || 0) + 1;

    // Month
    const mKey = (r.orderDate || '').slice(0, 7) || 'Unknown';
    if (!monthMap[mKey]) {
      monthMap[mKey] = { month: mKey, revenue: 0, fees: 0, units: 0, orders: new Set() };
    }
    monthMap[mKey].revenue += rev;
    monthMap[mKey].fees += fee;
    monthMap[mKey].units += qty;
    monthMap[mKey].orders.add(r.orderId);
  });

  const netPayout = grossRevenue - totalFees;

  // Compile SKU array with financial and planning calculations
  const productItems = Object.values(skuMap).map(it => {
    const p = it.match.matched ? it.match.product : null;
    const costPerUnit = p ? Number(p.current_cost || p.cost_price || 0) : 0;
    const totalCost = costPerUnit * it.units;
    const netSellerItem = it.revenue - it.fees;
    const profit = netSellerItem - totalCost;
    const marginPct = it.revenue > 0 ? (profit / it.revenue * 100) : 0;
    const stockQty = p ? Number(p.stock_qty || 0) : null;
    
    // Active months estimation
    const activeMonths = _shopeeSummaryPeriod === 'all' ? 6 : 1;
    const runRate = +(it.units / activeMonths).toFixed(1);
    const daysRemaining = (stockQty !== null && stockQty > 0 && runRate > 0) ? Math.round((stockQty / (runRate / 30))) : (stockQty !== null && stockQty <= 0 ? 0 : 999);
    const suggestedReorder = Math.max(0, Math.ceil((runRate * 2) - Math.max(0, stockQty || 0)));

    // Marketing Ads metrics
    const breakevenROAS = marginPct > 0 ? +(100 / marginPct).toFixed(2) : 0;
    const avgDealPrice = it.dealPrices.length ? (it.dealPrices.reduce((a,b)=>a+b,0)/it.dealPrices.length) : (it.revenue/it.units);
    const maxCPC = marginPct > 0 ? +((avgDealPrice * (marginPct / 100)) * 0.025).toFixed(2) : 0;

    // Classification
    let portfolioType = 'regular';
    if (it.units >= 10 && marginPct >= 40) portfolioType = 'star';
    else if (marginPct >= 50 && it.units >= 2) portfolioType = 'gem_ads';
    else if (it.units >= 10 && marginPct < 40) portfolioType = 'traffic_driver';
    else if (marginPct < 25 && it.units < 5) portfolioType = 'low_margin';

    // Stock urgency
    let stockStatus = 'healthy';
    if (p && stockQty <= 0) stockStatus = 'out_of_stock';
    else if (p && stockQty < (runRate * 1.5)) stockStatus = 'low_stock';
    else if (!p) stockStatus = 'unmatched';

    if (it.match.matched) {
      totalProductCost += totalCost;
    }

    return {
      ...it,
      orderCount: it.orders.size,
      matched: it.match.matched,
      matchedProduct: p,
      matchedVia: it.match.via,
      costPerUnit,
      totalCost,
      profit,
      marginPct,
      stockQty,
      runRate,
      daysRemaining,
      suggestedReorder,
      breakevenROAS,
      avgDealPrice,
      maxCPC,
      portfolioType,
      stockStatus
    };
  });

  const grossProfit = netPayout - totalProductCost;
  const marginPct = grossRevenue > 0 ? (grossProfit / grossRevenue * 100) : 0;
  const totalOrders = orderIds.size;
  const aov = totalOrders > 0 ? (grossRevenue / totalOrders) : 0;

  // Buyer analysis
  const buyersList = Object.values(buyerMap).map(b => ({
    ...b,
    orderCount: b.orders.size,
    avgBasket: b.spent / b.orders.size
  }));
  const repeatBuyers = buyersList.filter(b => b.orderCount > 1);
  const repeatRatePct = buyersList.length > 0 ? ((repeatBuyers.length / buyersList.length) * 100) : 0;

  // Province list
  const provincesList = Object.values(provinceMap).map(p => ({
    ...p,
    orderCount: p.orders.size,
    pctRevenue: grossRevenue > 0 ? ((p.revenue / grossRevenue) * 100) : 0
  })).sort((a,b) => b.orderCount - a.orderCount);

  // Regional breakdown
  const regionMap = {};
  provincesList.forEach(p => {
    if (!regionMap[p.region]) regionMap[p.region] = { region: p.region, orders: 0, revenue: 0, units: 0, provinces: [] };
    regionMap[p.region].orders += p.orderCount;
    regionMap[p.region].revenue += p.revenue;
    regionMap[p.region].units += p.units;
    regionMap[p.region].provinces.push(p.province);
  });
  const regionsList = Object.values(regionMap).sort((a,b) => b.revenue - a.revenue);

  // Ads classification metrics:
  // 1. High ROAS Buffer (คุ้มค่าที่สุด): Margin >= 60% and Breakeven ROAS <= 1.67x (Safest buffer, highest margin)
  const highBufferCandidates = productItems.filter(p => p.matched && p.marginPct >= 60 && p.breakevenROAS > 0 && p.breakevenROAS <= 1.67).sort((a,b) => a.breakevenROAS - b.breakevenROAS);

  // 2. Should Run Ads (ตัวที่ควรยิง Ads รวม): Margin >= 50% or Breakeven ROAS <= 2.0x (Standard high-profit candidates)
  const shouldRunAdsCandidates = productItems.filter(p => p.matched && p.marginPct >= 50 && p.breakevenROAS > 0 && p.breakevenROAS <= 2.0).sort((a,b) => a.breakevenROAS - b.breakevenROAS);

  // 3. Ready In Stock: Should run ads and has stock in house (> 0)
  const inStockAdsCandidates = shouldRunAdsCandidates.filter(p => p.stockQty !== null && p.stockQty > 0);

  // 4. Out of Stock Warning: Should run ads but stock is 0 or negative (must restock before ads)
  const outOfStockAdsCandidates = shouldRunAdsCandidates.filter(p => p.stockQty === null || p.stockQty <= 0);

  // 5. Top Stars (สินค้าขายดี & กำไรสูง): Units >= 3 and Margin >= 40% (High conversion proof)
  const topStarsCandidates = productItems.filter(p => p.matched && p.units >= 3 && p.marginPct >= 40).sort((a,b) => b.units - a.units);

  // 6. All Analyzed SKUs
  const allAnalyzedAds = productItems.filter(p => p.matched).sort((a,b) => (a.breakevenROAS || 999) - (b.breakevenROAS || 999));

  // Legacy adsCandidates fallback (mapped to shouldRunAdsCandidates)
  const adsCandidates = shouldRunAdsCandidates;

  // Stock danger: stockQty <= 0 or low stock
  const stockDanger = productItems.filter(p => p.matched && p.stockStatus === 'out_of_stock').sort((a,b) => b.units - a.units);
  const stockLow = productItems.filter(p => p.matched && p.stockStatus === 'low_stock').sort((a,b) => b.units - a.units);
  // Unmatched
  const unmatchedItems = productItems.filter(p => !p.matched);

  return {
    rows,
    totalOrders,
    totalUnits,
    grossRevenue,
    totalFees,
    totalCommission,
    totalTxFee,
    totalServiceFee,
    netPayout,
    totalProductCost,
    grossProfit,
    marginPct,
    aov,
    uniqueBuyers: buyersList.length,
    repeatBuyersCount: repeatBuyers.length,
    repeatRatePct,
    productItems,
    matchedCount: productItems.length - unmatchedItems.length,
    unmatchedCount: unmatchedItems.length,
    buyersList: buyersList.sort((a,b) => b.orderCount !== a.orderCount ? b.orderCount - a.orderCount : b.spent - a.spent),
    provincesList,
    regionsList,
    paymentMap,
    carrierMap,
    monthlyList: Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)),
    adsCandidates,
    highBufferCandidates,
    shouldRunAdsCandidates,
    inStockAdsCandidates,
    outOfStockAdsCandidates,
    topStarsCandidates,
    allAnalyzedAds,
    stockDanger,
    stockLow,
    unmatchedItems
  };
}

// ── Render Full Dashboard ──
function renderShopeeSummaryDashboard() {
  const container = document.getElementById('page-content');
  if (!container) return;

  const m = computeShopeeSummaryMetrics();

  container.innerHTML = `
    <!-- Top Filter & Controller Bar -->
    <div style="background:var(--bg2,#fff);border:1px solid var(--border,#e2e8f0);border-radius:12px;padding:14px 18px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:17px;font-weight:700;color:var(--text,#1e293b);display:flex;align-items:center;gap:8px">
            <span>🛒 Shopee Executive Summary & Planning</span>
            <span style="background:#e0f2fe;color:#0369a1;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;border:1px solid #bae6fd">v2.74 🚀</span>
          </div>
          <div style="font-size:12px;color:var(--text3,#64748b);margin-top:2px">
            รายงานวิเคราะห์คำสั่งซื้อจริงสำหรับหัวหน้าฝ่ายจัดซื้อ & หัวหน้าฝ่ายการตลาด (Planning Dashboard)
          </div>
        </div>

        <!-- Period selector pills -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span style="font-size:12px;color:var(--text3,#64748b);font-weight:600">ช่วงเวลา:</span>
          ${[
            { id: 'all', label: 'ทั้งหมด (6 เดือน)' },
            { id: '2026-04', label: 'เม.ย. 26' },
            { id: '2026-05', label: 'พ.ค. 26' },
            { id: '2026-06', label: 'มิ.ย. 26' },
            { id: '2026-07', label: 'ก.ค. 26' },
            { id: '2026-08', label: 'ส.ค. 26' },
            { id: '2026-09', label: 'ก.ย. 26' }
          ].map(p => `
            <button type="button" onclick="filterShopeeSummaryPeriod('${p.id}')"
              style="padding:4px 10px;font-size:12px;font-weight:600;border-radius:6px;cursor:pointer;border:1px solid ${_shopeeSummaryPeriod === p.id ? 'var(--accent,#00a882)' : 'var(--border2,#cbd5e1)'};background:${_shopeeSummaryPeriod === p.id ? 'var(--accent,#00a882)' : '#fff'};color:${_shopeeSummaryPeriod === p.id ? '#fff' : 'var(--text2,#475569)'}">
              ${p.label}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Search & quick filter row -->
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:260px;position:relative">
          <input type="text" id="shopee-summary-search" value="${escapeHTML(_shopeeSummarySearch)}" placeholder="🔍 พิมพ์ค้นหา SKU / ชื่อสินค้า / ผู้ซื้อ / จังหวัด..."
            oninput="searchShopeeSummary(this.value)"
            style="width:100%;padding:8px 12px;border:1px solid var(--border2,#cbd5e1);border-radius:8px;font-size:13px;box-sizing:border-box">
          ${_shopeeSummarySearch ? `<button onclick="searchShopeeSummary('')" style="position:absolute;right:8px;top:8px;background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px">✕</button>` : ''}
        </div>

        <div style="display:flex;gap:6px">
          <button type="button" onclick="filterShopeeSummaryLink('all')"
            style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid ${_shopeeSummaryLinkFilter==='all'?'var(--accent)':'var(--border2)'};background:${_shopeeSummaryLinkFilter==='all'?'#f0fdf4':'#fff'};color:${_shopeeSummaryLinkFilter==='all'?'#15803d':'var(--text2)'};cursor:pointer">
            สินค้าทั้งหมด (${m.productItems.length})
          </button>
          <button type="button" onclick="filterShopeeSummaryLink('linked')"
            style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid ${_shopeeSummaryLinkFilter==='linked'?'#16a34a':'var(--border2)'};background:${_shopeeSummaryLinkFilter==='linked'?'#dcfce7':'#fff'};color:${_shopeeSummaryLinkFilter==='linked'?'#15803d':'var(--text2)'};cursor:pointer">
            🟢 เชื่อมโยงแล้ว (${m.matchedCount})
          </button>
          <button type="button" onclick="filterShopeeSummaryLink('unmatched')"
            style="padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;border:1.5px solid ${_shopeeSummaryLinkFilter==='unmatched'?'#dc2626':'#fca5a5'};background:${_shopeeSummaryLinkFilter==='unmatched'?'#fee2e2':'#fff'};color:#dc2626;cursor:pointer">
            🔴 ยังไม่เชื่อมโยง (${m.unmatchedCount})
          </button>
        </div>
      </div>
    </div>

    <!-- 8 Executive KPI Stat Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:12px;margin-bottom:16px">
      <!-- 1. Gross Revenue -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">💰 ยอดขายสินค้า (GMV)</div>
        <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px">฿${m.grossRevenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#10b981;margin-top:2px">เฉลี่ย ฿${(m.grossRevenue / (_shopeeSummaryPeriod === 'all' ? 6 : 1)).toLocaleString('en-US',{maximumFractionDigits:0})}/เดือน</div>
      </div>

      <!-- 2. Net Payout -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">💵 รายรับสุทธิ (Net Payout)</div>
        <div style="font-size:20px;font-weight:700;color:#0284c7;margin-top:4px">฿${m.netPayout.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">ยอดเข้าบัญชีหลังหักค่าธรรมเนียม</div>
      </div>

      <!-- 3. Gross Profit & Margin -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04);background:#f0fdf4;border-color:#bbf7d0">
        <div style="font-size:11.5px;color:#15803d;font-weight:600">📈 กำไรขั้นต้นประเมิน</div>
        <div style="font-size:20px;font-weight:800;color:#16a34a;margin-top:4px">฿${m.grossProfit.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:11.5px;font-weight:700;color:#15803d;margin-top:2px">Margin เฉลี่ย: ${m.marginPct.toFixed(1)}%</div>
      </div>

      <!-- 4. Platform Fees -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">🏷️ ค่าธรรมเนียม Shopee</div>
        <div style="font-size:20px;font-weight:700;color:#ea580c;margin-top:4px">฿${m.totalFees.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:11px;color:#c2410c;margin-top:2px">หัก ${m.grossRevenue > 0 ? (m.totalFees/m.grossRevenue*100).toFixed(1) : 0}% ของยอดขาย</div>
      </div>

      <!-- 5. Orders & AOV -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">🛒 คำสั่งซื้อ & ตะกร้าเฉลี่ย</div>
        <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px">${m.totalOrders} <span style="font-size:13px;font-weight:normal;color:#64748b">ออเดอร์</span></div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">AOV: ฿${m.aov.toFixed(1)} / ออเดอร์</div>
      </div>

      <!-- 6. Total Units -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">📦 จำนวนชิ้นที่ขายได้</div>
        <div style="font-size:20px;font-weight:700;color:#7c3aed;margin-top:4px">${m.totalUnits} <span style="font-size:13px;font-weight:normal;color:#64748b">ชิ้น</span></div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${m.productItems.length} SKUs เคลื่อนไหว</div>
      </div>

      <!-- 7. Buyers & Repeat Rate -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
        <div style="font-size:11.5px;color:#64748b;font-weight:600">👥 ลูกค้า & ซื้อซ้ำ</div>
        <div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px">${m.uniqueBuyers} <span style="font-size:13px;font-weight:normal;color:#64748b">ราย</span></div>
        <div style="font-size:11px;color:#0284c7;font-weight:600;margin-top:2px">ซื้อซ้ำ: ${m.repeatBuyersCount} ราย (${m.repeatRatePct.toFixed(1)}%)</div>
      </div>

      <!-- 8. Linkage Status -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04);${m.unmatchedCount>0?'background:#fff8f8;border-color:#fca5a5':''}">
        <div style="font-size:11.5px;color:${m.unmatchedCount>0?'#b91c1c':'#15803d'};font-weight:600">🔗 เชื่อมโยงฐานข้อมูล</div>
        <div style="font-size:20px;font-weight:700;color:${m.unmatchedCount>0?'#dc2626':'#16a34a'};margin-top:4px">${m.matchedCount} / ${m.productItems.length}</div>
        <div style="font-size:11px;color:${m.unmatchedCount>0?'#b91c1c':'#15803d'};font-weight:600;margin-top:2px">
          ${m.unmatchedCount > 0 ? `⚠️ ต้องผูกเพิ่ม ${m.unmatchedCount} รายการ` : '✓ ครบถ้วน 100%'}
        </div>
      </div>
    </div>

    <!-- Planning Navigation Tabs -->
    <div style="display:flex;gap:4px;border-bottom:2px solid var(--border,#e2e8f0);margin-bottom:16px;overflow-x:auto;padding-bottom:2px">
      ${[
        { id: 'overview', icon: '📊', label: 'ภาพรวม & สรุปสินค้า (Overview)' },
        { id: 'ads', icon: '🎯', label: `แผนการตลาด & ยิง Ads (${m.adsCandidates.length})` },
        { id: 'stock', icon: '📦', label: `แผนจัดซื้อ & สต๊อก (${m.stockDanger.length} วิกฤต)` },
        { id: 'geo', icon: '🗺️', label: `ภูมิศาสตร์ลูกค้า (${m.provincesList.length} จังหวัด)` },
        { id: 'buyers', icon: '👥', label: `ลูกค้าประจำ & ช่องทางชำระ (${m.repeatBuyersCount})` },
        { id: 'linkage', icon: '🔗', label: `เชื่อมโยง Database (${m.unmatchedCount ? '⚠️ ' + m.unmatchedCount : 'ครบ'})` }
      ].map(t => `
        <button type="button" onclick="switchShopeeSummaryTab('${t.id}')"
          style="padding:10px 16px;font-size:13px;font-weight:${_shopeeSummaryTab === t.id ? '700' : '500'};border:none;background:none;cursor:pointer;border-bottom:3px solid ${_shopeeSummaryTab === t.id ? 'var(--accent,#00a882)' : 'transparent'};color:${_shopeeSummaryTab === t.id ? 'var(--accent,#00a882)' : 'var(--text2,#475569)'};white-space:nowrap;display:inline-flex;align-items:center;gap:6px">
          <span>${t.icon}</span> <span>${t.label}</span>
        </button>
      `).join('')}
    </div>

    <!-- Active Tab Content Area -->
    <div id="shopee-summary-tab-content">
      ${renderShopeeSummaryActiveTab(m)}
    </div>
  `;

  // Render Charts if on overview or geo tab
  setTimeout(() => {
    renderShopeeSummaryCharts(m);
  }, 100);
}

// ── Switch Tabs ──
function switchShopeeSummaryTab(tab) {
  _shopeeSummaryTab = tab;
  renderShopeeSummaryDashboard();
}

function filterShopeeSummaryPeriod(period) {
  _shopeeSummaryPeriod = period;
  renderShopeeSummaryDashboard();
}

function filterShopeeSummaryLink(type) {
  _shopeeSummaryLinkFilter = type;
  if (type === 'unmatched') {
    _shopeeSummaryTab = 'linkage';
  }
  renderShopeeSummaryDashboard();
}

function searchShopeeSummary(val) {
  _shopeeSummarySearch = val;
  renderShopeeSummaryDashboard();
}

function sortShopeeSummaryTable(col) {
  if (_shopeeSummarySortBy === col) {
    _shopeeSummarySortDir = _shopeeSummarySortDir === 'desc' ? 'asc' : 'desc';
  } else {
    _shopeeSummarySortBy = col;
    _shopeeSummarySortDir = 'desc';
  }
  renderShopeeSummaryDashboard();
}

// ── Render Active Tab Content ──
function renderShopeeSummaryActiveTab(m) {
  switch (_shopeeSummaryTab) {
    case 'overview': return renderShopeeTabOverview(m);
    case 'ads': return renderShopeeTabAds(m);
    case 'stock': return renderShopeeTabStock(m);
    case 'geo': return renderShopeeTabGeo(m);
    case 'buyers': return renderShopeeTabBuyers(m);
    case 'linkage': return renderShopeeTabLinkage(m);
    default: return renderShopeeTabOverview(m);
  }
}

// ──────────────────────────────────────────────────────────────
// TAB 1: OVERVIEW & PRODUCT MATRIX
// ──────────────────────────────────────────────────────────────
function renderShopeeTabOverview(m) {
  let items = [...m.productItems];

  if (_shopeeSummaryLinkFilter === 'linked') items = items.filter(x => x.matched);
  if (_shopeeSummaryLinkFilter === 'unmatched') items = items.filter(x => !x.matched);

  // Sorting
  items.sort((a,b) => {
    let vA = a[_shopeeSummarySortBy];
    let vB = b[_shopeeSummarySortBy];
    if (vA === null || vA === undefined) vA = -999999;
    if (vB === null || vB === undefined) vB = -999999;
    return _shopeeSummarySortDir === 'desc' ? (vB > vA ? 1 : -1) : (vA > vB ? 1 : -1);
  });

  return `
    <!-- Top Charts Row -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:16px">
      <!-- Monthly Revenue & Margin Growth -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:700;font-size:14px;color:#1e293b">📈 แนวโน้มยอดขาย & กำไรรายเดือน (Shopee Growth)</div>
          <span style="font-size:11px;color:#64748b">เม.ย. - ก.ย. 2026</span>
        </div>
        <div style="position:relative;height:220px;width:100%">
          <canvas id="chart-shopee-monthly-growth"></canvas>
        </div>
      </div>

      <!-- Fees Breakdown & Channel -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:10px">🏷️ โครงสร้างค่าธรรมเนียม Shopee</div>
        <div style="position:relative;height:220px;width:100%">
          <canvas id="chart-shopee-fees-pie"></canvas>
        </div>
      </div>
    </div>

    <!-- Product Portfolio Matrix Pills -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;font-weight:700;color:#1e293b">กลยุทธ์สินค้า (Portfolio Matrix):</span>
      <span onclick="switchShopeeSummaryTab('ads');setShopeeAdsFilter('high_buffer')" style="cursor:pointer;background:#ecfdf5;color:#047857;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;border:1.5px solid #6ee7b7;box-shadow:0 1px 2px rgba(4,120,87,0.1)" title="คลิกเพื่อดูรายการสินค้า Ads คุ้มค่าที่สุด (High ROAS Buffer)">
        💎 Ads คุ้มค่าที่สุด (High Buffer): ${m.highBufferCandidates.length} SKUs ➔
      </span>
      <span onclick="switchShopeeSummaryTab('ads');setShopeeAdsFilter('should_run_ads')" style="cursor:pointer;background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #bae6fd" title="คลิกเพื่อดูรายการสินค้าที่ควรยิง Ads ทั้งหมด">
        🎯 สินค้าเป้าหมายยิง Ads: ${m.shouldRunAdsCandidates.length} SKUs ➔
      </span>
      <span onclick="switchShopeeSummaryTab('ads');setShopeeAdsFilter('top_stars')" style="cursor:pointer;background:#dcfce7;color:#15803d;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #86efac" title="คลิกเพื่อดูสินค้าขายดี & กำไรสูง">
        🌟 ขายดี & กำไรสูง (Stars): ${m.topStarsCandidates.length} SKUs ➔
      </span>
      <span onclick="switchShopeeSummaryTab('stock')" style="cursor:pointer;background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;border:1px solid #fca5a5" title="คลิกเพื่อดูสินค้าที่สต๊อกหมด">
        🚨 ขายแล้วสต๊อกหมด: ${m.stockDanger.length} SKUs ➔
      </span>
    </div>

    <!-- Main Products Table -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc">
        <div style="font-weight:700;font-size:13px;color:#1e293b">
          รายการสินค้าทั้งหมด (${items.length} รายการ)
        </div>
        <div style="font-size:11.5px;color:#64748b">
          คลิกที่หัวตารางเพื่อเรียงลำดับ | ข้อมูลเชื่อมโยงกับฐานข้อมูลสต๊อก & ต้นทุนร้านจริง
        </div>
      </div>

      <div style="overflow-x:auto;max-height:550px">
        <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:left">
          <thead style="position:sticky;top:0;background:#f1f5f9;z-index:2;border-bottom:2px solid #cbd5e1">
            <tr>
              <th style="padding:10px 12px;color:#475569">#</th>
              <th style="padding:10px 12px;color:#475569">SKU / ชื่อสินค้า Shopee</th>
              <th style="padding:10px 12px;color:#475569">สถานะ DB</th>
              <th onclick="sortShopeeSummaryTable('units')" style="padding:10px 12px;color:#475569;cursor:pointer;text-align:right">
                จำนวนขาย ${getSortArrow('units')}
              </th>
              <th onclick="sortShopeeSummaryTable('revenue')" style="padding:10px 12px;color:#475569;cursor:pointer;text-align:right">
                ยอดขาย (฿) ${getSortArrow('revenue')}
              </th>
              <th style="padding:10px 12px;color:#475569;text-align:right">ค่าธรรมเนียม</th>
              <th style="padding:10px 12px;color:#475569;text-align:right">ต้นทุนรวม</th>
              <th onclick="sortShopeeSummaryTable('profit')" style="padding:10px 12px;color:#475569;cursor:pointer;text-align:right">
                กำไรสุทธิ (฿) ${getSortArrow('profit')}
              </th>
              <th onclick="sortShopeeSummaryTable('marginPct')" style="padding:10px 12px;color:#475569;cursor:pointer;text-align:right">
                % Margin ${getSortArrow('marginPct')}
              </th>
              <th onclick="sortShopeeSummaryTable('stockQty')" style="padding:10px 12px;color:#475569;cursor:pointer;text-align:right">
                สต๊อกคงเหลือ ${getSortArrow('stockQty')}
              </th>
              <th style="padding:10px 12px;color:#475569;text-align:center">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const p = it.matchedProduct;
              const isDanger = p && it.stockQty <= 0;
              const isHighMargin = it.marginPct >= 50 && it.units >= 2;
              return `
                <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fbfcfd'};${isDanger?'background:#fff8f8':''}">
                  <td style="padding:10px 12px;color:#94a3b8;font-family:var(--mono)">${idx+1}</td>
                  <td style="padding:10px 12px;max-width:260px">
                    <div style="font-weight:700;color:var(--text);font-family:var(--mono);font-size:12.5px">${escapeHTML(it.sku)}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;line-height:1.3" title="${escapeHTML(it.name)}">
                      ${escapeHTML(it.name.length > 55 ? it.name.slice(0, 55) + '...' : it.name)}
                    </div>
                    ${it.option ? `<span style="font-size:10px;background:#f1f5f9;color:#475569;padding:1px 6px;border-radius:4px;display:inline-block;margin-top:2px">ตัวเลือก: ${escapeHTML(it.option)}</span>` : ''}
                  </td>
                  <td style="padding:10px 12px">
                    ${it.matched ? `
                      <span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:3px">
                        ✓ เชื่อมโยงแล้ว
                      </span>
                      <div style="font-size:10px;color:#64748b;margin-top:2px">DB SKU: <b>${escapeHTML(p?.sku || '-')}</b></div>
                    ` : `
                      <button type="button" onclick="switchShopeeSummaryTab('linkage');searchShopeeSummary('${escapeHTML(it.sku)}')"
                        style="background:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;border:1px solid #fca5a5;cursor:pointer">
                        ⚠️ ยังไม่เชื่อมโยง ✏️
                      </button>
                    `}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:13px;font-family:var(--mono)">
                    ${it.units.toLocaleString()}
                    <div style="font-size:10px;color:#64748b;font-weight:normal">${it.orderCount} ออเดอร์</div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:13px;font-family:var(--mono)">
                    ฿${it.revenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </td>
                  <td style="padding:10px 12px;text-align:right;color:#ea580c;font-family:var(--mono)">
                    -฿${it.fees.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </td>
                  <td style="padding:10px 12px;text-align:right;color:#64748b;font-family:var(--mono)">
                    ${it.matched ? `฿${it.totalCost.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '<span style="color:#94a3b8">-</span>'}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;font-family:var(--mono);color:${it.profit>0?'#16a34a':'#dc2626'}">
                    ${it.matched ? `฿${it.profit.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '<span style="color:#94a3b8">-</span>'}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-weight:700;font-family:var(--mono)">
                    ${it.matched ? `
                      <span style="color:${it.marginPct>=50?'#15803d':(it.marginPct>=30?'#0369a1':'#dc2626')}">
                        ${it.marginPct.toFixed(1)}%
                      </span>
                    ` : '<span style="color:#94a3b8">-</span>'}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">
                    ${it.matched ? (
                      it.stockQty <= 0
                        ? `<span style="background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:6px;font-weight:700;border:1px solid #fca5a5">0 ชิ้น (หมด)</span>`
                        : `<span style="font-weight:700;color:${it.stockQty<10?'#d97706':'#15803d'}">${it.stockQty} ชิ้น</span>`
                    ) : '<span style="color:#94a3b8">-</span>'}
                  </td>
                  <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                    ${it.matched && isDanger ? `
                      <button type="button" class="btn btn-warning btn-sm" onclick="quickCreatePOFromShopee('${p?.id||''}','${escapeHTML(it.sku)}','${escapeHTML(it.name)}',${Math.max(10, it.suggestedReorder)},${it.costPerUnit})"
                        style="padding:3px 8px;font-size:11px" title="ออกใบสั่งซื้อ PO ด่วน">
                        🛒 สั่งซื้อ PO
                      </button>
                    ` : ''}
                    ${isHighMargin ? `
                      <button type="button" class="btn btn-secondary btn-sm" onclick="switchShopeeSummaryTab('ads');searchShopeeSummary('${escapeHTML(it.sku)}')"
                        style="padding:3px 7px;font-size:10.5px;background:#e0f2fe;color:#0369a1;border-color:#bae6fd" title="ดูข้อมูลยิง Ads">
                        🎯 ยิง Ads
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getSortArrow(col) {
  if (_shopeeSummarySortBy !== col) return '<span style="color:#cbd5e1">↕</span>';
  return _shopeeSummarySortDir === 'desc' ? '▼' : '▲';
}

// ──────────────────────────────────────────────────────────────
// TAB 2: MARKETING & ADS PLANNING
// ──────────────────────────────────────────────────────────────
function setShopeeAdsFilter(filter) {
  _shopeeAdsFilter = filter;
  renderShopeeSummaryDashboard();
}

function searchShopeeAds(query) {
  _shopeeAdsSearch = query || '';
  renderShopeeSummaryDashboard();
}

function sortShopeeAds(col) {
  if (_shopeeAdsSortBy === col) {
    _shopeeAdsSortDir = _shopeeAdsSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _shopeeAdsSortBy = col;
    _shopeeAdsSortDir = (col === 'buffer' || col === 'breakevenROAS') ? 'asc' : 'desc';
  }
  renderShopeeSummaryDashboard();
}

function getShopeeAdsSortIndicator(col) {
  if (_shopeeAdsSortBy !== col) return '<span style="color:#cbd5e1;font-size:10px;margin-left:2px">⇅</span>';
  return _shopeeAdsSortDir === 'desc' 
    ? '<span style="color:var(--accent,#00a882);font-weight:800;font-size:10px;margin-left:2px">▼</span>' 
    : '<span style="color:var(--accent,#00a882);font-weight:800;font-size:10px;margin-left:2px">▲</span>';
}

function renderShopeeTabAds(m) {
  // Determine dataset based on _shopeeAdsFilter
  let adsList = [];
  let filterTitle = '';
  let filterDesc = '';
  let filterBadge = '';

  if (_shopeeAdsFilter === 'high_buffer') {
    adsList = [...(m.highBufferCandidates || [])];
    filterTitle = '💎 Ads คุ้มค่าที่สุด (High ROAS Buffer)';
    filterDesc = 'สินค้าที่มีอัตรากำไรสูงมาก (% Margin ≥ 60%) และ Breakeven ROAS ต่ำมาก (≤ 1.67x) ปลอดภัยสูงสุด ค่าโฆษณาไม่กินทุน กำไรเหลือเยอะ';
    filterBadge = 'background:#dcfce7;color:#15803d;border:1px solid #86efac';
  } else if (_shopeeAdsFilter === 'should_run_ads') {
    adsList = [...(m.shouldRunAdsCandidates || [])];
    filterTitle = '🎯 สินค้าที่ควรยิง Ads ทั้งหมด (Recommended Candidates)';
    filterDesc = 'สินค้าที่ผ่านเกณฑ์อัตรากำไร % Margin ≥ 50% (Breakeven ROAS ≤ 2.0x) เหมาะสำหรับการตั้งค่า Shopee Search Ads และ Discovery Ads';
    filterBadge = 'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe';
  } else if (_shopeeAdsFilter === 'in_stock') {
    adsList = [...(m.inStockAdsCandidates || [])];
    filterTitle = '📦 มีสต๊อกพร้อมยิงทันที (In Stock & Ready)';
    filterDesc = 'สินค้าที่ผ่านเกณฑ์ยิง Ads และมีสต๊อกในคลัง > 0 พร้อมเปิดแคมเปญได้ทันที ออเดอร์ไม่สะดุด ไม่เสี่ยงของหมด';
    filterBadge = 'background:#f0fdfa;color:#0f766e;border:1px solid #99f6e4';
  } else if (_shopeeAdsFilter === 'top_stars') {
    adsList = [...(m.topStarsCandidates || [])];
    filterTitle = '🌟 สินค้าขายดี & กำไรสูง (Top Stars & Proven Demand)';
    filterDesc = 'สินค้าที่มียอดขายสูง (3 ชิ้นขึ้นไป) และมี % Margin ≥ 40% มี Conversion Proof สูงมาก ลูกค้าตัดสินใจซื้อง่าย';
    filterBadge = 'background:#fef3c7;color:#92400e;border:1px solid #fde68a';
  } else if (_shopeeAdsFilter === 'out_of_stock') {
    adsList = [...(m.outOfStockAdsCandidates || [])];
    filterTitle = '⚠️ สินค้ากำไรดีแต่สต๊อกหมด (Restock Before Ads)';
    filterDesc = 'สินค้ากำไรสูงที่น่าทำแอดมาก แต่สต๊อกในระบบหมด (0 ชิ้น) ต้องเปิดใบสั่งซื้อ (PO) เติมของก่อนเปิดโฆษณา';
    filterBadge = 'background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5';
  } else {
    adsList = [...(m.allAnalyzedAds || m.productItems || [])];
    filterTitle = '📋 รายการสินค้า Shopee ทั้งหมดที่วิเคราะห์';
    filterDesc = 'แสดงข้อมูลวิเคราะห์ความคุ้มค่าการยิง Ads และ Breakeven ROAS ของสินค้าทุกตัวในร้าน';
    filterBadge = 'background:#f1f5f9;color:#475569;border:1px solid #cbd5e1';
  }

  // Search filter
  if (_shopeeAdsSearch && _shopeeAdsSearch.trim()) {
    const q = _shopeeAdsSearch.toLowerCase().trim();
    adsList = adsList.filter(it => 
      (it.sku && it.sku.toLowerCase().includes(q)) ||
      (it.name && it.name.toLowerCase().includes(q)) ||
      (it.parentSku && it.parentSku.toLowerCase().includes(q)) ||
      (it.matchedProduct && it.matchedProduct.sku && it.matchedProduct.sku.toLowerCase().includes(q))
    );
  }

  // Sorting
  adsList.sort((a,b) => {
    let vA = 0;
    let vB = 0;
    if (_shopeeAdsSortBy === 'buffer' || _shopeeAdsSortBy === 'breakevenROAS') {
      vA = a.breakevenROAS || 999;
      vB = b.breakevenROAS || 999;
    } else if (_shopeeAdsSortBy === 'marginPct') {
      vA = a.marginPct || 0;
      vB = b.marginPct || 0;
    } else if (_shopeeAdsSortBy === 'profit') {
      vA = (a.units > 0 ? (a.profit / a.units) : 0);
      vB = (b.units > 0 ? (b.profit / b.units) : 0);
    } else if (_shopeeAdsSortBy === 'totalProfit') {
      vA = a.profit || 0;
      vB = b.profit || 0;
    } else if (_shopeeAdsSortBy === 'avgDealPrice') {
      vA = a.avgDealPrice || 0;
      vB = b.avgDealPrice || 0;
    } else if (_shopeeAdsSortBy === 'costPerUnit') {
      vA = a.costPerUnit || 0;
      vB = b.costPerUnit || 0;
    } else if (_shopeeAdsSortBy === 'units') {
      vA = a.units || 0;
      vB = b.units || 0;
    } else if (_shopeeAdsSortBy === 'stockQty') {
      vA = a.stockQty !== null ? a.stockQty : -999;
      vB = b.stockQty !== null ? b.stockQty : -999;
    } else if (_shopeeAdsSortBy === 'maxCPC') {
      vA = a.maxCPC || 0;
      vB = b.maxCPC || 0;
    } else if (_shopeeAdsSortBy === 'name' || _shopeeAdsSortBy === 'sku') {
      return _shopeeAdsSortDir === 'desc' 
        ? (b.sku || '').localeCompare(a.sku || '') 
        : (a.sku || '').localeCompare(b.sku || '');
    }
    return _shopeeAdsSortDir === 'desc' ? (vB - vA) : (vA - vB);
  });

  return `
    <!-- Top Strategic Intro Banner -->
    <div style="background:linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%);border:1.5px solid #bfdbfe;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:#1e40af;display:flex;align-items:center;gap:6px">
            🎯 แผนการตลาดยิง Ads: วิเคราะห์ความคุ้มค่า &amp; คัดกรอง High ROAS Buffer
          </div>
          <div style="font-size:12px;color:#1e3a8a;margin-top:4px;line-height:1.5">
            ระบบคำนวณ <b>Breakeven ROAS</b> (จุดคุ้มทุนค่าโฆษณา) จากโครงสร้างราคาขาย หักค่าธรรมเนียม Shopee และต้นทุนสินค้าจริง ยิ่งค่า Breakeven ROAS ต่ำ ยิ่งมี <b>ROAS Buffer</b> สูง ปลอดภัย ไม่กินทุน
          </div>
        </div>
        <div style="text-align:right;display:flex;align-items:center;gap:8px">
          <span style="background:#1d4ed8;color:#fff;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:20px;box-shadow:0 2px 4px rgba(29,78,216,0.25)">
            🎯 เป้าหมายยิง Ads: ${m.shouldRunAdsCandidates.length} SKUs
          </span>
          <span style="background:#16a34a;color:#fff;font-size:12.5px;font-weight:700;padding:4px 12px;border-radius:20px;box-shadow:0 2px 4px rgba(22,163,74,0.25)">
            💎 High Buffer: ${m.highBufferCandidates.length} SKUs
          </span>
        </div>
      </div>
    </div>

    <!-- 4 Clickable KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:14px">
      <!-- Card 1: High Buffer -->
      <div onclick="setShopeeAdsFilter('high_buffer')" 
        style="cursor:pointer;background:${_shopeeAdsFilter === 'high_buffer' ? '#f0fdf4' : '#fff'};border:2px solid ${_shopeeAdsFilter === 'high_buffer' ? '#16a34a' : '#e2e8f0'};border-radius:10px;padding:12px 14px;box-shadow:${_shopeeAdsFilter === 'high_buffer' ? '0 4px 12px rgba(22,163,74,0.18)' : '0 1px 3px rgba(0,0,0,0.05)'};transition:all 0.15s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:#15803d">💎 Ads คุ้มค่าที่สุด (High Buffer)</span>
          <span style="background:#dcfce7;color:#15803d;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800;border:1px solid #86efac">Safe 100%</span>
        </div>
        <div style="font-size:22px;font-weight:800;color:#166534;font-family:var(--mono)">${m.highBufferCandidates.length} <span style="font-size:12px;font-weight:600">SKUs</span></div>
        <div style="font-size:11px;color:#15803d;margin-top:3px">Breakeven ROAS ≤ 1.67x (Margin ≥ 60%)</div>
      </div>

      <!-- Card 2: Should Run Ads -->
      <div onclick="setShopeeAdsFilter('should_run_ads')" 
        style="cursor:pointer;background:${_shopeeAdsFilter === 'should_run_ads' ? '#eff6ff' : '#fff'};border:2px solid ${_shopeeAdsFilter === 'should_run_ads' ? '#2563eb' : '#e2e8f0'};border-radius:10px;padding:12px 14px;box-shadow:${_shopeeAdsFilter === 'should_run_ads' ? '0 4px 12px rgba(37,99,235,0.18)' : '0 1px 3px rgba(0,0,0,0.05)'};transition:all 0.15s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:#1d4ed8">🎯 ตัวที่ควรยิง Ads ทั้งหมด</span>
          <span style="background:#e0f2fe;color:#0369a1;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800;border:1px solid #bae6fd">Candidates</span>
        </div>
        <div style="font-size:22px;font-weight:800;color:#1e40af;font-family:var(--mono)">${m.shouldRunAdsCandidates.length} <span style="font-size:12px;font-weight:600">SKUs</span></div>
        <div style="font-size:11px;color:#1d4ed8;margin-top:3px">Margin ≥ 50% / ROAS ≤ 2.0x มีประวัติขาย</div>
      </div>

      <!-- Card 3: In Stock & Ready -->
      <div onclick="setShopeeAdsFilter('in_stock')" 
        style="cursor:pointer;background:${_shopeeAdsFilter === 'in_stock' ? '#f0fdfa' : '#fff'};border:2px solid ${_shopeeAdsFilter === 'in_stock' ? '#0d9488' : '#e2e8f0'};border-radius:10px;padding:12px 14px;box-shadow:${_shopeeAdsFilter === 'in_stock' ? '0 4px 12px rgba(13,148,136,0.18)' : '0 1px 3px rgba(0,0,0,0.05)'};transition:all 0.15s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:#0f766e">📦 พร้อมยิงทันที (มีสต๊อก)</span>
          <span style="background:#ccfbf1;color:#0f766e;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800;border:1px solid #99f6e4">เปิด Ads ได้เลย</span>
        </div>
        <div style="font-size:22px;font-weight:800;color:#0f766e;font-family:var(--mono)">${m.inStockAdsCandidates.length} <span style="font-size:12px;font-weight:600">SKUs</span></div>
        <div style="font-size:11px;color:#0f766e;margin-top:3px">สต๊อกในคลัง > 0 พร้อมส่ง ไม่เสี่ยงของขาด</div>
      </div>

      <!-- Card 4: Out of Stock Warning -->
      <div onclick="setShopeeAdsFilter('out_of_stock')" 
        style="cursor:pointer;background:${_shopeeAdsFilter === 'out_of_stock' ? '#fff1f2' : '#fff'};border:2px solid ${_shopeeAdsFilter === 'out_of_stock' ? '#e11d48' : '#e2e8f0'};border-radius:10px;padding:12px 14px;box-shadow:${_shopeeAdsFilter === 'out_of_stock' ? '0 4px 12px rgba(225,29,72,0.18)' : '0 1px 3px rgba(0,0,0,0.05)'};transition:all 0.15s ease">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:700;color:#be123c">⚠️ สต๊อกหมด (รอเติมก่อนยิง)</span>
          <span style="background:#ffe4e6;color:#be123c;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:800;border:1px solid #fecdd3">ต้องทำ PO</span>
        </div>
        <div style="font-size:22px;font-weight:800;color:#be123c;font-family:var(--mono)">${m.outOfStockAdsCandidates.length} <span style="font-size:12px;font-weight:600">SKUs</span></div>
        <div style="font-size:11px;color:#be123c;margin-top:3px">กำไรสูงมากแต่สต๊อก 0 สั่งซื้อเติมก่อนเปิดแอด</div>
      </div>
    </div>

    <!-- Dedicated Filter Buttons Row -->
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px;background:#fff;border:1px solid #e2e8f0;padding:10px 14px;border-radius:10px;box-shadow:0 1px 2px rgba(0,0,0,0.03)">
      <span style="font-size:12px;font-weight:700;color:#334155;margin-right:2px">กดเพื่อ Filter:</span>

      <button type="button" onclick="setShopeeAdsFilter('high_buffer')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'high_buffer' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'high_buffer' ? '#16a34a' : '#cbd5e1'};background:${_shopeeAdsFilter === 'high_buffer' ? '#16a34a' : '#f8fafc'};color:${_shopeeAdsFilter === 'high_buffer' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'high_buffer' ? '0 2px 6px rgba(22,163,74,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>💎 Ads คุ้มค่าที่สุด (High ROAS Buffer)</span>
        <span style="background:${_shopeeAdsFilter === 'high_buffer' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.highBufferCandidates.length}</span>
      </button>

      <button type="button" onclick="setShopeeAdsFilter('should_run_ads')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'should_run_ads' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'should_run_ads' ? '#2563eb' : '#cbd5e1'};background:${_shopeeAdsFilter === 'should_run_ads' ? '#2563eb' : '#f8fafc'};color:${_shopeeAdsFilter === 'should_run_ads' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'should_run_ads' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>🎯 ตัวที่ควรยิง Ads ทั้งหมด</span>
        <span style="background:${_shopeeAdsFilter === 'should_run_ads' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.shouldRunAdsCandidates.length}</span>
      </button>

      <button type="button" onclick="setShopeeAdsFilter('in_stock')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'in_stock' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'in_stock' ? '#0d9488' : '#cbd5e1'};background:${_shopeeAdsFilter === 'in_stock' ? '#0d9488' : '#f8fafc'};color:${_shopeeAdsFilter === 'in_stock' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'in_stock' ? '0 2px 6px rgba(13,148,136,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>📦 มีสต๊อกพร้อมยิงทันที</span>
        <span style="background:${_shopeeAdsFilter === 'in_stock' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.inStockAdsCandidates.length}</span>
      </button>

      <button type="button" onclick="setShopeeAdsFilter('top_stars')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'top_stars' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'top_stars' ? '#d97706' : '#cbd5e1'};background:${_shopeeAdsFilter === 'top_stars' ? '#d97706' : '#f8fafc'};color:${_shopeeAdsFilter === 'top_stars' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'top_stars' ? '0 2px 6px rgba(217,119,6,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>🌟 สินค้าขายดี &amp; กำไรสูง</span>
        <span style="background:${_shopeeAdsFilter === 'top_stars' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.topStarsCandidates.length}</span>
      </button>

      <button type="button" onclick="setShopeeAdsFilter('out_of_stock')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'out_of_stock' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'out_of_stock' ? '#e11d48' : '#cbd5e1'};background:${_shopeeAdsFilter === 'out_of_stock' ? '#e11d48' : '#f8fafc'};color:${_shopeeAdsFilter === 'out_of_stock' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'out_of_stock' ? '0 2px 6px rgba(225,29,72,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>⚠️ สต๊อกหมด / ต้องเติมของ</span>
        <span style="background:${_shopeeAdsFilter === 'out_of_stock' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.outOfStockAdsCandidates.length}</span>
      </button>

      <button type="button" onclick="setShopeeAdsFilter('all')"
        style="cursor:pointer;font-size:12px;font-weight:${_shopeeAdsFilter === 'all' ? '800' : '600'};padding:6px 13px;border-radius:8px;border:1.5px solid ${_shopeeAdsFilter === 'all' ? '#475569' : '#cbd5e1'};background:${_shopeeAdsFilter === 'all' ? '#475569' : '#f8fafc'};color:${_shopeeAdsFilter === 'all' ? '#fff' : '#1e293b'};box-shadow:${_shopeeAdsFilter === 'all' ? '0 2px 6px rgba(71,85,105,0.3)' : 'none'};display:inline-flex;align-items:center;gap:6px;transition:all 0.15s ease">
        <span>📋 ดูทั้งหมดที่วิเคราะห์</span>
        <span style="background:${_shopeeAdsFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#e2e8f0'};padding:1px 7px;border-radius:10px;font-size:11px">${m.allAnalyzedAds.length}</span>
      </button>
    </div>

    <!-- Ads Candidates Table Container -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#f8fafc;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-weight:700;font-size:14px;color:#1e293b;display:flex;align-items:center;gap:8px">
            <span>ตารางวิเคราะห์ความคุ้มค่าการยิง Ads &amp; คำนวณ Breakeven ROAS</span>
            <span style="font-size:11.5px;padding:2px 8px;border-radius:6px;font-weight:700;${filterBadge}">
              ${filterTitle}
            </span>
          </div>
          <div style="font-size:11.5px;color:#64748b;margin-top:3px">
            ${filterDesc} (พบ ${adsList.length} รายการ)
          </div>
        </div>

        <!-- Search input inside Ads table -->
        <div style="display:flex;align-items:center;gap:8px">
          <div style="position:relative">
            <input type="text" value="${escapeHTML(_shopeeAdsSearch)}" oninput="searchShopeeAds(this.value)"
              placeholder="🔍 ค้นหา SKU / ชื่อสินค้า..."
              style="padding:6px 12px;font-size:12px;border:1px solid #cbd5e1;border-radius:6px;width:220px;outline:none">
            ${_shopeeAdsSearch ? `<button type="button" onclick="searchShopeeAds('')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-weight:700">✕</button>` : ''}
          </div>
        </div>
      </div>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
            <tr>
              <th onclick="sortShopeeAds('sku')" style="cursor:pointer;padding:10px 12px;text-align:left;white-space:nowrap">
                SKU / ชื่อสินค้า ${getShopeeAdsSortIndicator('sku')}
              </th>
              <th onclick="sortShopeeAds('avgDealPrice')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                ราคาขายเฉลี่ย ${getShopeeAdsSortIndicator('avgDealPrice')}
              </th>
              <th onclick="sortShopeeAds('costPerUnit')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                ต้นทุนสินค้า ${getShopeeAdsSortIndicator('costPerUnit')}
              </th>
              <th onclick="sortShopeeAds('profit')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                กำไรต่อชิ้น ${getShopeeAdsSortIndicator('profit')}
              </th>
              <th onclick="sortShopeeAds('marginPct')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                % Margin ${getShopeeAdsSortIndicator('marginPct')}
              </th>
              <th onclick="sortShopeeAds('breakevenROAS')" style="cursor:pointer;padding:10px 12px;text-align:right;background:#ecfeff;color:#0e7490;white-space:nowrap" title="จุดคุ้มทุนค่าโฆษณา (ยิ่งต่ำยิ่งดี/เซฟสุด)">
                Breakeven ROAS 💡 ${getShopeeAdsSortIndicator('breakevenROAS')}
              </th>
              <th style="padding:10px 12px;text-align:center;background:#f0fdf4;color:#166534;white-space:nowrap" title="ระดับความคุ้มค่าและ Buffer ความปลอดภัย">
                ระดับ ROAS Buffer
              </th>
              <th style="padding:10px 12px;text-align:right;background:#eff6ff;color:#1d4ed8;white-space:nowrap" title="เป้าหมาย ROAS ที่แนะนำให้ตั้งในระบบยิงแอด">
                Target ROAS ที่แนะนำ
              </th>
              <th onclick="sortShopeeAds('maxCPC')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap" title="ราคาบิดคลิกสูงสุดที่ไม่ทำให้ขาดทุน">
                Max CPC แนะนำ ${getShopeeAdsSortIndicator('maxCPC')}
              </th>
              <th onclick="sortShopeeAds('units')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                ยอดขายที่ผ่านมา ${getShopeeAdsSortIndicator('units')}
              </th>
              <th onclick="sortShopeeAds('stockQty')" style="cursor:pointer;padding:10px 12px;text-align:right;white-space:nowrap">
                สต๊อกพร้อมส่ง ${getShopeeAdsSortIndicator('stockQty')}
              </th>
              <th style="padding:10px 12px;text-align:center;white-space:nowrap">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${adsList.length === 0 ? `
              <tr>
                <td colspan="12" style="text-align:center;padding:40px 20px;color:#94a3b8">
                  <div style="font-size:28px;margin-bottom:8px">🔍</div>
                  <div style="font-size:14px;font-weight:700;color:#64748b">ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขการค้นหา / ตัวกรองนี้</div>
                  <div style="font-size:12px;margin-top:4px">ลองเปลี่ยนตัวกรองเป็น "🎯 ตัวที่ควรยิง Ads ทั้งหมด" หรือ "📋 ดูทั้งหมดที่วิเคราะห์"</div>
                </td>
              </tr>
            ` : adsList.map((it, idx) => {
              const unitProfit = it.units > 0 ? (it.profit / it.units) : 0;
              const hasStock = it.stockQty !== null && it.stockQty > 0;

              // Buffer classification badge
              let bufferBadgeHTML = '';
              if (it.marginPct >= 65 && it.breakevenROAS <= 1.54) {
                bufferBadgeHTML = `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:800;border:1px solid #86efac;white-space:nowrap">💎 Ultra Buffer</span>`;
              } else if (it.marginPct >= 60 && it.breakevenROAS <= 1.67) {
                bufferBadgeHTML = `<span style="background:#ecfdf5;color:#047857;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:800;border:1px solid #6ee7b7;white-space:nowrap">💎 High Buffer</span>`;
              } else if (it.marginPct >= 50 && it.breakevenROAS <= 2.0) {
                bufferBadgeHTML = `<span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid #bfdbfe;white-space:nowrap">🎯 Safe Buffer</span>`;
              } else if (it.marginPct >= 35) {
                bufferBadgeHTML = `<span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid #fde68a;white-space:nowrap">⚖️ กำไรปานกลาง</span>`;
              } else {
                bufferBadgeHTML = `<span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;border:1px solid #fca5a5;white-space:nowrap">⚠️ กำไรน้อย</span>`;
              }

              return `
                <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fbfcfd'};transition:background 0.1s ease" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='${idx%2===0?'#fff':'#fbfcfd'}'">
                  <td style="padding:10px 12px;max-width:260px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-weight:700;color:var(--text,#1e293b);font-family:var(--mono)">${escapeHTML(it.sku)}</span>
                      ${it.portfolioType === 'star' ? `<span style="background:#fef3c7;color:#b45309;font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px">STAR</span>` : ''}
                    </div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(it.name)}">
                      ${escapeHTML(it.name.slice(0, 52))}
                    </div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">฿${it.avgDealPrice.toFixed(2)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);color:#64748b">฿${it.costPerUnit.toFixed(2)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:#16a34a">฿${unitProfit.toFixed(2)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">
                    <span style="background:${it.marginPct >= 60 ? '#dcfce7' : (it.marginPct >= 45 ? '#eff6ff' : '#fef3c7')};color:${it.marginPct >= 60 ? '#15803d' : (it.marginPct >= 45 ? '#1d4ed8' : '#b45309')};padding:2px 6px;border-radius:4px;font-weight:700">
                      ${it.marginPct.toFixed(1)}%
                    </span>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:800;background:#ecfeff;color:#0e7490">
                    ${it.breakevenROAS > 0 ? `${it.breakevenROAS}x` : '-'}
                  </td>
                  <td style="padding:10px 12px;text-align:center">
                    ${bufferBadgeHTML}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:800;background:#eff6ff;color:#1d4ed8">
                    ${it.breakevenROAS > 0 ? `${(it.breakevenROAS * 1.5).toFixed(1)}x - ${(it.breakevenROAS * 2.2).toFixed(1)}x` : '-'}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:600">
                    ฿${it.maxCPC}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">${it.units} ชิ้น</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">
                    ${hasStock 
                      ? `<span style="color:#16a34a;font-weight:700">✓ ${it.stockQty} ชิ้น</span>` 
                      : `<span style="color:#dc2626;font-weight:700;background:#fee2e2;padding:2px 6px;border-radius:4px">⚠️ 0 ชิ้น</span>`}
                  </td>
                  <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                    <div style="display:flex;gap:4px;justify-content:center">
                      <button type="button" class="btn btn-secondary btn-sm" onclick="copyShopeeAdsBrief('${escapeHTML(it.sku)}', '${escapeHTML(it.name)}', ${it.avgDealPrice}, ${it.breakevenROAS})"
                        style="font-size:11px;padding:3px 8px;background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe;font-weight:700" title="คัดลอกข้อมูลสินค้าและ Breakeven ROAS สำหรับตั้งค่า Ads">
                        📋 คัดลอก
                      </button>
                      ${!hasStock ? `
                        <button type="button" class="btn btn-sm" onclick="quickCreatePOFromShopee('${escapeHTML(it.sku)}', '${escapeHTML(it.name)}')"
                          style="font-size:11px;padding:3px 8px;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;font-weight:700" title="สินค้าหมด! กดเพื่อเปิดหน้าทำใบสั่งซื้อ (PO) เติมสต๊อกทันที">
                          🛒 ทำ PO
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function copyShopeeAdsBrief(sku, name, price, roas) {
  const txt = `สินค้าสำหรับยิง Shopee Ads:
SKU: ${sku}
ชื่อ: ${name}
ราคาขาย: ฿${price.toFixed(2)}
Breakeven ROAS: ${roas}x (เป้าหมายแคมเปญ > ${(roas*1.5).toFixed(1)}x - ${(roas*2.2).toFixed(1)}x)
High ROAS Buffer: คืนทุนง่าย กำไรสูง`;
  navigator.clipboard.writeText(txt).then(() => {
    toast('คัดลอกข้อมูลสินค้าทำแอดเรียบร้อย ✓', 'success');
  });
}
// ──────────────────────────────────────────────────────────────
// TAB 3: PROCUREMENT & BUFFER STOCK PLANNING
// ──────────────────────────────────────────────────────────────
function renderShopeeTabStock(m) {
  const outOfStock = m.stockDanger;
  const lowStock = m.stockLow;

  return `
    <div style="background:#fef2f2;border:1.5px solid #fecaca;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:#991b1b;display:flex;align-items:center;gap:6px">
            🚨 แผนจัดซื้อ: รายการสินค้าขายดีที่สต๊อกหมด / วิกฤต (Out-of-Stock Alert)
          </div>
          <div style="font-size:12px;color:#7f1d1d;margin-top:4px;line-height:1.5">
            มีสินค้า <b>${outOfStock.length} รายการ</b> ที่เคยขายได้บน Shopee แต่ปัจจุบันในระบบสต๊อกเป็น 0 หรือติดลบ ทำให้เสียโอกาสขาย หัวหน้าฝ่ายจัดซื้อควรออกใบสั่งซื้อ (PO) เติมสต๊อกทันที
          </div>
        </div>
        <div style="text-align:right">
          <span style="background:#dc2626;color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:20px">
            ต้องรีบสั่งซื้อ: ${outOfStock.length} SKUs
          </span>
        </div>
      </div>
    </div>

    <!-- Out of Stock Table -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:20px">
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;background:#fff1f2">
        <div style="font-weight:700;font-size:13px;color:#9f1239">
          🚨 สินค้าขายดีแต่สต๊อกหมด (Stock &le; 0) — แนะนำออก PO ทันที
        </div>
      </div>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:#ffe4e6;border-bottom:2px solid #fecdd3">
            <tr>
              <th style="padding:10px 12px;text-align:left">SKU / ชื่อสินค้า</th>
              <th style="padding:10px 12px;text-align:right">ยอดขายรวม</th>
              <th style="padding:10px 12px;text-align:right">ยอดขายเฉลี่ย/เดือน</th>
              <th style="padding:10px 12px;text-align:right">สต๊อกจริงในคลัง</th>
              <th style="padding:10px 12px;text-align:right">ต้นทุน/ชิ้น</th>
              <th style="padding:10px 12px;text-align:right;background:#fef3c7;color:#92400e">
                จำนวนที่ควรสั่งเพิ่ม (2 เดือน)
              </th>
              <th style="padding:10px 12px;text-align:center">การดำเนินการ</th>
            </tr>
          </thead>
          <tbody>
            ${outOfStock.map((it, idx) => {
              const p = it.matchedProduct;
              const suggested = Math.max(10, it.suggestedReorder || Math.ceil(it.runRate * 2));
              return `
                <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fff5f5'}">
                  <td style="padding:10px 12px;max-width:280px">
                    <div style="font-weight:700;color:var(--text);font-family:var(--mono)">${escapeHTML(it.sku)}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHTML(it.name.slice(0, 50))}</div>
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700">${it.units} ชิ้น</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">${it.runRate} ชิ้น/ด.</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:#dc2626">
                    ${it.stockQty} ชิ้น
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">฿${it.costPerUnit.toFixed(2)}</td>
                  <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:800;background:#fef3c7;color:#92400e">
                    ${suggested} ชิ้น
                  </td>
                  <td style="padding:10px 12px;text-align:center">
                    <button type="button" class="btn btn-primary btn-sm" onclick="quickCreatePOFromShopee('${p?.id||''}','${escapeHTML(it.sku)}','${escapeHTML(it.name)}',${suggested},${it.costPerUnit})"
                      style="font-size:11px;padding:4px 10px;background:#dc2626;border-color:#b91c1c">
                      🛒 ออก PO ทันที
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
// TAB 4: CUSTOMER GEOGRAPHY
// ──────────────────────────────────────────────────────────────
function renderShopeeTabGeo(m) {
  const regions = m.regionsList;
  const provinces = m.provincesList;

  return `
    <!-- Regional Cards -->
    <div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:10px">🗺️ สรุปสัดส่วนยอดขายตามภูมิภาค 6 ภาค</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px">
        ${regions.map(r => `
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
            <div style="font-size:12px;font-weight:700;color:#1e293b">${r.region}</div>
            <div style="font-size:18px;font-weight:800;color:#0284c7;margin-top:4px">฿${r.revenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${r.orders} ออเดอร์ (${r.units} ชิ้น)</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Chart + Top Provinces Grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <!-- Province Chart -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:10px">📊 10 อันดับจังหวัดที่มียอดสั่งซื้อสูงสุด</div>
        <div style="position:relative;height:240px;width:100%">
          <canvas id="chart-shopee-geo-bar"></canvas>
        </div>
      </div>

      <!-- Logistics & Delivery Carriers -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:10px">🚚 ผู้ให้บริการขนส่งพัสดุ (Carriers)</div>
        <div style="position:relative;height:240px;width:100%">
          <canvas id="chart-shopee-carrier-pie"></canvas>
        </div>
      </div>
    </div>

    <!-- Province Details Table -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;font-size:13px;color:#1e293b">
        รายชื่อจังหวัดปลายทางทั้งหมด (${provinces.length} จังหวัด)
      </div>
      <div style="overflow-x:auto;max-height:400px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
            <tr>
              <th style="padding:10px 12px;text-align:left">#</th>
              <th style="padding:10px 12px;text-align:left">จังหวัด</th>
              <th style="padding:10px 12px;text-align:left">ภูมิภาค</th>
              <th style="padding:10px 12px;text-align:right">จำนวนออเดอร์</th>
              <th style="padding:10px 12px;text-align:right">จำนวนชิ้น</th>
              <th style="padding:10px 12px;text-align:right">ยอดขายรวม (฿)</th>
              <th style="padding:10px 12px;text-align:right">สัดส่วน %</th>
            </tr>
          </thead>
          <tbody>
            ${provinces.map((p, idx) => `
              <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fbfcfd'}">
                <td style="padding:10px 12px;color:#94a3b8">${idx+1}</td>
                <td style="padding:10px 12px;font-weight:700">${escapeHTML(p.province)}</td>
                <td style="padding:10px 12px;color:#64748b">${escapeHTML(p.region)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700">${p.orderCount}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">${p.units}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700">฿${p.revenue.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">${p.pctRevenue.toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
// TAB 5: BUYERS & PAYMENT CHANNELS
// ──────────────────────────────────────────────────────────────
function renderShopeeTabBuyers(m) {
  const buyers = m.buyersList;
  const payMap = m.paymentMap;
  const codCount = payMap['เก็บเงินปลายทาง'] || 0;
  const totalPay = Object.values(payMap).reduce((a,b)=>a+b, 0);
  const codPct = totalPay > 0 ? (codCount / totalPay * 100) : 0;

  return `
    <!-- Top Insight Alert -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <!-- Payment method alert -->
      <div>
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:8px">💳 พฤติกรรมการชำระเงินของลูกค้า</div>
        <div style="font-size:12px;color:#64748b;line-height:1.5">
          ลูกค้าใช้ <b>เก็บเงินปลายทาง (COD)</b> คิดเป็น <b style="color:#dc2626">${codPct.toFixed(1)}%</b> (${codCount} ครั้ง)
          ซึ่งต้องระวังความเสี่ยงพัสดุตีกลับ ส่วนที่เหลือเป็นการชำระล่วงหน้าผ่าน PromptPay, SPayLater และบัตรเครดิต
        </div>
      </div>

      <!-- Repeat buyer stats -->
      <div>
        <div style="font-weight:700;font-size:14px;color:#1e293b;margin-bottom:8px">👥 สถิติการซื้อซ้ำ (Repeat Buyers)</div>
        <div style="font-size:12px;color:#64748b;line-height:1.5">
          มีลูกค้าประจำที่กลับมาซื้อซ้ำ <b>${m.repeatBuyersCount} ราย</b> (คิดเป็น ${m.repeatRatePct.toFixed(1)}% ของลูกค้าทั้งหมด) แสดงถึงความเชื่อมั่นในคุณภาพของอะไหล่ซีล
        </div>
      </div>
    </div>

    <!-- Top Buyers Table -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;font-size:13px;color:#1e293b">
        รายชื่อลูกค้าประจำ & ซื้อบ่อยที่สุด (Top Repeat Customers)
      </div>
      <div style="overflow-x:auto;max-height:450px">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
            <tr>
              <th style="padding:10px 12px;text-align:left">#</th>
              <th style="padding:10px 12px;text-align:left">ชื่อผู้ใช้ (ผู้ซื้อ)</th>
              <th style="padding:10px 12px;text-align:left">จังหวัด</th>
              <th style="padding:10px 12px;text-align:right">จำนวนคำสั่งซื้อ</th>
              <th style="padding:10px 12px;text-align:right">จำนวนชิ้นรวม</th>
              <th style="padding:10px 12px;text-align:right">ยอดซื้อรวม (฿)</th>
              <th style="padding:10px 12px;text-align:right">ซื้อเฉลี่ย/ครั้ง</th>
              <th style="padding:10px 12px;text-align:center">วันที่ซื้อล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            ${buyers.slice(0, 50).map((b, idx) => `
              <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fbfcfd'};${b.orderCount>1?'background:#f0fdf4':''}">
                <td style="padding:10px 12px;color:#94a3b8">${idx+1}</td>
                <td style="padding:10px 12px;font-weight:700">
                  ${escapeHTML(b.buyer)}
                  ${b.orderCount > 1 ? `<span style="background:#dcfce7;color:#15803d;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:4px">ซื้อซ้ำ</span>` : ''}
                </td>
                <td style="padding:10px 12px;color:#64748b">${escapeHTML(b.province)}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700;color:${b.orderCount>1?'#15803d':'var(--text)'}">${b.orderCount}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">${b.units}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono);font-weight:700">฿${b.spent.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                <td style="padding:10px 12px;text-align:right;font-family:var(--mono)">฿${b.avgBasket.toFixed(1)}</td>
                <td style="padding:10px 12px;text-align:center;font-family:var(--mono);color:#64748b">${b.lastDate || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
// TAB 6: DATABASE SKU LINKAGE & USER MAPPING
// ──────────────────────────────────────────────────────────────
function renderShopeeTabLinkage(m) {
  const items = _shopeeSummaryLinkFilter === 'linked'
    ? m.productItems.filter(p => p.matched)
    : (_shopeeSummaryLinkFilter === 'unmatched' ? m.unmatchedItems : m.productItems);

  const allProds = window.allProducts || [];

  return `
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:15px;font-weight:700;color:#1e293b">
            🔗 การเชื่อมโยงรายการสินค้า Shopee เข้ากับฐานข้อมูลร้าน (Database SKU Mappings)
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">
            หากรายการใดแสดงป้ายสีแดง <b>"ยังไม่เชื่อมโยง"</b> ให้เลือกสินค้าในระบบและกดบันทึก ระบบจะจำรหัสและดึงต้นทุนกับสต๊อกมาคำนวณกำไรอัตโนมัติ
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button type="button" onclick="filterShopeeSummaryLink('all')"
            style="padding:5px 10px;font-size:12px;font-weight:600;border-radius:6px;border:1px solid ${_shopeeSummaryLinkFilter==='all'?'var(--accent)':'#cbd5e1'};background:${_shopeeSummaryLinkFilter==='all'?'#f0fdf4':'#fff'};color:${_shopeeSummaryLinkFilter==='all'?'#15803d':'#475569'};cursor:pointer">
            ทั้งหมด (${m.productItems.length})
          </button>
          <button type="button" onclick="filterShopeeSummaryLink('unmatched')"
            style="padding:5px 10px;font-size:12px;font-weight:700;border-radius:6px;border:1.5px solid #dc2626;background:${_shopeeSummaryLinkFilter==='unmatched'?'#fee2e2':'#fff'};color:#dc2626;cursor:pointer">
            🔴 ยังไม่เชื่อมโยง (${m.unmatchedCount})
          </button>
          <button type="button" onclick="filterShopeeSummaryLink('linked')"
            style="padding:5px 10px;font-size:12px;font-weight:600;border-radius:6px;border:1px solid ${_shopeeSummaryLinkFilter==='linked'?'#16a34a':'#cbd5e1'};background:${_shopeeSummaryLinkFilter==='linked'?'#dcfce7':'#fff'};color:${_shopeeSummaryLinkFilter==='linked'?'#15803d':'#475569'};cursor:pointer">
            🟢 เชื่อมโยงแล้ว (${m.matchedCount})
          </button>
        </div>
      </div>
    </div>

    <!-- Mapping Table -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
            <tr>
              <th style="padding:10px 12px;text-align:left">#</th>
              <th style="padding:10px 12px;text-align:left">รหัส SKU Shopee</th>
              <th style="padding:10px 12px;text-align:left">ชื่อสินค้าใน Shopee</th>
              <th style="padding:10px 12px;text-align:center">สถานะ</th>
              <th style="padding:10px 12px;text-align:left">เลือกสินค้าในระบบเชื่อมโยง (Update Mapping)</th>
              <th style="padding:10px 12px;text-align:center">การบันทึก</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((it, idx) => {
              const selId = `map-sel-${idx}`;
              return `
                <tr style="border-bottom:1px solid #e2e8f0;background:${idx%2===0?'#fff':'#fbfcfd'};${!it.matched?'background:#fff8f8':''}">
                  <td style="padding:10px 12px;color:#94a3b8">${idx+1}</td>
                  <td style="padding:10px 12px;font-weight:700;font-family:var(--mono)">${escapeHTML(it.sku)}</td>
                  <td style="padding:10px 12px;max-width:260px;line-height:1.3">${escapeHTML(it.name)}</td>
                  <td style="padding:10px 12px;text-align:center">
                    ${it.matched ? `
                      <span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">
                        🟢 เชื่อมโยงแล้ว
                      </span>
                    ` : `
                      <span style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:10px;font-weight:700;font-size:11px">
                        🔴 ยังไม่เชื่อมโยง
                      </span>
                    `}
                  </td>
                  <td style="padding:10px 12px;min-width:320px">
                    <select id="${selId}" style="width:100%;padding:6px 10px;border:1px solid var(--border2);border-radius:6px;font-size:12px;background:#fff">
                      <option value="">-- ${it.matched ? 'เปลี่ยนสินค้าที่เชื่อมโยง...' : 'ค้นหาและเลือกสินค้าในฐานข้อมูล...'} --</option>
                      ${allProds.slice(0, 300).map(p => `
                        <option value="${p.id}" ${it.matchedProduct?.id === p.id ? 'selected' : ''}>
                          ${escapeHTML(p.sku || p.supplier_sku || '')} | ${escapeHTML(p.name)} (ทุน: ฿${p.current_cost||0}, สต๊อก: ${p.stock_qty||0})
                        </option>
                      `).join('')}
                    </select>
                  </td>
                  <td style="padding:10px 12px;text-align:center;white-space:nowrap">
                    <button type="button" class="btn btn-primary btn-sm" onclick="handleSaveShopeeMapping('${escapeHTML(it.sku)}', '${selId}', '${escapeHTML(it.name)}')"
                      style="font-size:11px;padding:4px 10px">
                      💾 บันทึกเชื่อมโยง
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Handle Save SKU Mapping ──
async function handleSaveShopeeMapping(platformSku, selectElId, itemName) {
  const sel = document.getElementById(selectElId);
  const prodId = sel?.value;
  if (!prodId) {
    toast('กรุณาเลือกสินค้าในระบบก่อนบันทึก', 'error');
    return;
  }
  await saveShopeeSummaryMapping(platformSku, prodId, itemName);
}

// ── Save Mapping into Supabase ──
async function saveShopeeSummaryMapping(platformSku, productId, itemName = '') {
  if (!platformSku || !productId) {
    toast('กรุณาเลือกสินค้าในระบบก่อนบันทึก', 'error');
    return;
  }
  try {
    const payload = {
      shop_id: currentShop.id,
      channel: 'shopee',
      platform_sku: String(platformSku).trim(),
      platform_item_name: itemName || null,
      product_id: productId,
      multiplier: 1,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from('marketplace_sku_mappings')
      .upsert(payload, { onConflict: 'shop_id,channel,platform_sku' });
    if (error) throw error;

    const existingIdx = _shopeeSummaryMappings.findIndex(m => m.platform_sku === payload.platform_sku);
    if (existingIdx >= 0) {
      _shopeeSummaryMappings[existingIdx] = payload;
    } else {
      _shopeeSummaryMappings.push(payload);
    }

    toast(`บันทึกเชื่อมโยง SKU "${platformSku}" สำเร็จ ✓`, 'success');
    renderShopeeSummaryDashboard();
  } catch (err) {
    console.error('Error saving mapping:', err);
    toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
  }
}

// ── Quick PO Integration ──
function quickCreatePOFromShopee(productId, sku, name, suggestedQty, unitCost) {
  if (typeof openNewPO !== 'function') {
    toast('ฟังก์ชัน PO ไม่พร้อมใช้งาน', 'error');
    return;
  }
  const prefilled = [{
    product_id: productId || null,
    product_name: name || sku,
    sku: sku || '',
    qty_ordered: Math.max(1, suggestedQty || 10),
    unit_cost: unitCost > 0 ? unitCost : ''
  }];
  openNewPO(prefilled);
  toast(`เตรียมรายการ ${sku} เข้าใบสั่งซื้อ (PO) เรียบร้อย ✓`, 'success');
}

// ── Render Chart.js Visualizations ──
function renderShopeeSummaryCharts(m) {
  // Destroy old charts
  Object.values(_shopeeSummaryCharts).forEach(c => c?.destroy && c.destroy());
  _shopeeSummaryCharts = {};

  if (_shopeeSummaryTab === 'overview') {
    // 1. Monthly growth chart
    const el1 = document.getElementById('chart-shopee-monthly-growth');
    if (el1 && m.monthlyList.length > 0) {
      const labels = m.monthlyList.map(x => x.month);
      const revs = m.monthlyList.map(x => x.revenue);
      const fees = m.monthlyList.map(x => x.fees);
      const nets = m.monthlyList.map(x => x.revenue - x.fees);

      _shopeeSummaryCharts.monthly = new Chart(el1, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'ยอดขายรวม (Gross)', data: revs, backgroundColor: '#0284c7' },
            { label: 'รับสุทธิ (Net Payout)', data: nets, backgroundColor: '#10b981' },
            { label: 'ค่าธรรมเนียม (Fees)', data: fees, backgroundColor: '#f97316' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { font: { size: 11 } } } }
        }
      });
    }

    // 2. Fees breakdown pie
    const el2 = document.getElementById('chart-shopee-fees-pie');
    if (el2) {
      _shopeeSummaryCharts.fees = new Chart(el2, {
        type: 'doughnut',
        data: {
          labels: ['ค่าคอมมิชชั่น', 'Transaction Fee', 'ค่าบริการ'],
          datasets: [{
            data: [m.totalCommission || 1, m.totalTxFee || 1, m.totalServiceFee || 1],
            backgroundColor: ['#ef4444', '#f59e0b', '#8b5cf6']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
        }
      });
    }
  } else if (_shopeeSummaryTab === 'geo') {
    // 3. Top provinces bar
    const el3 = document.getElementById('chart-shopee-geo-bar');
    if (el3) {
      const top10 = m.provincesList.slice(0, 10);
      _shopeeSummaryCharts.geo = new Chart(el3, {
        type: 'bar',
        data: {
          labels: top10.map(x => x.province),
          datasets: [{
            label: 'จำนวนออเดอร์',
            data: top10.map(x => x.orderCount),
            backgroundColor: '#0284c7'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } }
        }
      });
    }

    // 4. Carrier pie
    const el4 = document.getElementById('chart-shopee-carrier-pie');
    if (el4) {
      const cKeys = Object.keys(m.carrierMap);
      const cVals = Object.values(m.carrierMap);
      _shopeeSummaryCharts.carrier = new Chart(el4, {
        type: 'pie',
        data: {
          labels: cKeys.map(k => k.split('-').pop() || k),
          datasets: [{
            data: cVals,
            backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#6366f1']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }
        }
      });
    }
  }
}

// ── Upload Shopee Excel / CSV ──
async function uploadShopeeSummaryExcel(input) {
  const file = input.files?.[0];
  if (!file) return;

  try {
    toast('กำลังอ่านไฟล์ ' + file.name + '...', 'info');
    const buf = await file.arrayBuffer();
    let rows = [];

    if (window.XLSX) {
      const wb = window.XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = window.XLSX.utils.sheet_to_json(ws, { defval: '' });
    } else {
      const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    }

    if (!rows || rows.length === 0) throw new Error('ไม่พบข้อมูลคำสั่งซื้อในไฟล์');

    const cleanNum = v => {
      if (v === null || v === undefined) return 0;
      return parseFloat(String(v).replace(/[฿,\s]/g, '')) || 0;
    };

    const newOrders = rows.map(r => {
      const orderId = String(r['หมายเลขคำสั่งซื้อ'] || r['Order ID'] || '').trim();
      if (!orderId) return null;
      const sku = String(r['เลขอ้างอิง SKU (SKU Reference No.)'] || r['SKU Reference No.'] || '').trim();
      const parentSku = String(r['เลขอ้างอิง Parent SKU'] || r['Parent SKU'] || '').trim();
      const prodName = String(r['ชื่อสินค้า'] || r['Product Name'] || '').trim();
      const qty = int(cleanNum(r['จำนวน'] || r['Quantity']) || 1);
      const dealPrice = cleanNum(r['ราคาขาย'] || r['Deal Price']);
      const netSale = cleanNum(r['ราคาขายสุทธิ'] || r['Net Sale']);
      const commission = cleanNum(r['ค่าคอมมิชชั่น'] || r['Commission']);
      const txFee = cleanNum(r['Transaction Fee'] || r['Transaction fee']);
      const serviceFee = cleanNum(r['ค่าบริการ'] || r['Service Fee']);
      const totalFee = commission + txFee + serviceFee;

      return {
        orderId,
        status: String(r['สถานะการสั่งซื้อ'] || '').trim(),
        buyer: String(r['ชื่อผู้ใช้ (ผู้ซื้อ)'] || 'ไม่ระบุ').trim(),
        orderDate: String(r['วันที่ทำการสั่งซื้อ'] || '').slice(0, 19),
        payMethod: String(r['ช่องทางการชำระเงิน'] || '').trim(),
        carrier: String(r['ตัวเลือกการจัดส่ง'] || '').trim(),
        tracking: String(r['*หมายเลขติดตามพัสดุ'] || '').trim(),
        parentSku,
        productName: prodName,
        sku: sku || parentSku,
        option: String(r['ชื่อตัวเลือก'] || '').trim(),
        qty,
        dealPrice,
        netSale: netSale > 0 ? netSale : (dealPrice * qty),
        commission,
        txFee,
        serviceFee,
        totalFee,
        shipping: cleanNum(r['ค่าจัดส่งที่ชำระโดยผู้ซื้อ']),
        totalAmt: cleanNum(r['จำนวนเงินทั้งหมด']),
        recipient: String(r['ชื่อผู้รับ'] || '').trim(),
        province: String(r['จังหวัด'] || '').replace('จังหวัด', '').trim(),
        district: String(r['เขต/อำเภอ'] || '').trim(),
        zipcode: String(r['รหัสไปรษณีย์'] || '').trim()
      };
    }).filter(Boolean);

    // Merge & deduplicate
    const existingKeys = new Set(_shopeeSummaryOrders.map(o => `${o.orderId}_${o.sku}`));
    let added = 0;
    newOrders.forEach(o => {
      const k = `${o.orderId}_${o.sku}`;
      if (!existingKeys.has(k)) {
        _shopeeSummaryOrders.push(o);
        existingKeys.add(k);
        added++;
      }
    });

    try { localStorage.setItem('shopee_summary_orders_cache', JSON.stringify(_shopeeSummaryOrders)); } catch(e){}

    toast(`นำเข้าไฟล์ "${file.name}" สำเร็จ! เพิ่มรายการใหม่ ${added} รายการ (รวม ${_shopeeSummaryOrders.length} รายการ) ✓`, 'success');
    renderShopeeSummaryDashboard();
  } catch (err) {
    console.error('Upload error:', err);
    toast('นำเข้าไฟล์ไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    input.value = '';
  }
}

// ── Sync Summary to AI Server & Knowledge Base ──
async function syncShopeeSummaryToAI() {
  const btn = document.getElementById('shopee-summary-sync-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ กำลังส่งข้อมูล...'; }

  try {
    const m = computeShopeeSummaryMetrics();
    const payload = {
      timestamp: new Date().toISOString(),
      shop_id: currentShop?.id || null,
      shop_name: currentShop?.name || 'SEALTHAI',
      total_orders: m.totalOrders,
      gross_revenue: m.grossRevenue,
      net_payout: m.netPayout,
      total_fees: m.totalFees,
      gross_profit: m.grossProfit,
      margin_pct: m.marginPct,
      total_units: m.totalUnits,
      unique_buyers: m.uniqueBuyers,
      repeat_rate_pct: m.repeatRatePct,
      top_ads_products: m.adsCandidates.slice(0, 10).map(p => ({
        sku: p.sku, name: p.name, margin: p.marginPct, profit: p.profit, breakeven_roas: p.breakevenROAS, stock: p.stockQty
      })),
      stock_alerts: m.stockDanger.slice(0, 10).map(p => ({
        sku: p.sku, name: p.name, units_sold: p.units, stock: p.stockQty
      })),
      top_provinces: m.provincesList.slice(0, 10).map(p => ({
        province: p.province, orders: p.orderCount, revenue: p.revenue
      }))
    };

    // Save to ai_chat_logs
    try {
      await sb.from('ai_chat_logs').insert([{
        shop_id: currentShop?.id || null,
        user_id: currentUser?.id || null,
        message: 'Shopee Executive Summary Sync',
        response: JSON.stringify(payload),
        created_at: new Date().toISOString()
      }]);
    } catch(e){}

    localStorage.setItem('shopee_summary_ai_latest', JSON.stringify(payload));
    toast('ส่งข้อมูลวิเคราะห์เข้าฐานข้อมูลและ AI Engine เรียบร้อย ✓', 'success');
    showShopeeAISummaryModal(payload);
  } catch(err) {
    toast('ส่งข้อมูลไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '☁️ ซิงค์เข้า AI Server'; }
  }
}

// ── Show AI Brief Modal ──
function showShopeeAISummaryModal(payload) {
  document.getElementById('modal-shopee-ai-brief')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'modal-shopee-ai-brief';
  overlay.className = 'modal-overlay open';
  overlay.style.zIndex = '2400';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '680px';
  modal.innerHTML = `
    <div class="modal-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>🤖 AI Executive Planning Brief</span>
      <button type="button" onclick="document.getElementById('modal-shopee-ai-brief').remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#64748b">✕</button>
    </div>
    
    <div style="font-size:12.5px;color:#334155;line-height:1.6;max-height:460px;overflow-y:auto;padding-right:8px">
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-weight:700;color:#15803d">📊 สรุปภาพรวมสำหรับผู้บริหาร:</div>
        <div>• ยอดขายรวม (GMV): <b>฿${payload.gross_revenue.toLocaleString('en-US',{minimumFractionDigits:2})}</b> | รับสุทธิ: <b>฿${payload.net_payout.toLocaleString('en-US',{minimumFractionDigits:2})}</b></div>
        <div>• กำไรขั้นต้นประเมิน: <b>฿${payload.gross_profit.toLocaleString('en-US',{minimumFractionDigits:2})}</b> (Margin: <b>${payload.margin_pct.toFixed(1)}%</b>)</div>
        <div>• คำสั่งซื้อทั้งหมด: <b>${payload.total_orders} ออเดอร์</b> (${payload.total_units} ชิ้น) | ลูกค้าซื้อซ้ำ <b>${payload.repeat_rate_pct.toFixed(1)}%</b></div>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="font-weight:700;color:#1d4ed8">🎯 คำแนะนำสำหรับหัวหน้าฝ่ายการตลาด (Marketing Head):</div>
        <div>1. มีสินค้า Margin &gt; 50% พร้อมยิงแอด <b>${payload.top_ads_products.length} รายการ</b></div>
        <div>2. สินค้าแนะนำอันดับ 1-3: <b>${payload.top_ads_products.slice(0,3).map(p=>p.sku).join(', ')}</b></div>
        <div>3. ควรตั้ง Target ROAS ไม่ต่ำกว่า <b>2.5x - 3.0x</b> และเจาะพื้นที่เป้าหมายกลุ่มนิคมอุตสาหกรรม (ระยอง, ชลบุรี, สมุทรปราการ, อยุธยา)</div>
      </div>

      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px">
        <div style="font-weight:700;color:#b91c1c">📦 คำแนะนำสำหรับหัวหน้าฝ่ายจัดซื้อ (Purchasing Head):</div>
        <div>1. พบสินค้าขายดีแต่สต๊อกหมด (Out of Stock) <b>${payload.stock_alerts.length} รายการ</b></div>
        <div>2. รายการเร่งด่วนที่ควรออก PO สั่งซื้อเติมคลังทันที: <b>${payload.stock_alerts.slice(0,3).map(p=>p.sku).join(', ')}</b></div>
        <div>3. สำรองสต๊อก Buffer อย่างน้อย 60 วัน เพื่อไม่ให้เสียโอกาสขายบน Shopee</div>
      </div>
    </div>

    <div class="modal-footer" style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-shopee-ai-brief').remove()">ปิด</button>
      <button class="btn btn-primary" onclick="copyAIBriefToClipboard()">📋 คัดลอกรายงาน</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function copyAIBriefToClipboard() {
  const brief = localStorage.getItem('shopee_summary_ai_latest');
  if (brief) {
    navigator.clipboard.writeText(brief).then(() => toast('คัดลอกรายงานสรุป AI เรียบร้อย ✓', 'success'));
  }
}

// ── Export CSV ──
function exportShopeeSummaryCSV() {
  const m = computeShopeeSummaryMetrics();
  const headers = ['SKU', 'Product Name', 'Matched DB SKU', 'Units Sold', 'Orders Count', 'Gross Revenue', 'Shopee Fees', 'Net Payout', 'Unit Cost', 'Total Cost', 'Gross Profit', 'Margin Pct', 'Stock Qty', 'Run Rate (Monthly)', 'Suggested Reorder'];
  const rows = m.productItems.map(p => [
    `"${(p.sku||'').replace(/"/g, '""')}"`,
    `"${(p.name||'').replace(/"/g, '""')}"`,
    `"${(p.matchedProduct?.sku||'UNMATCHED').replace(/"/g, '""')}"`,
    p.units,
    p.orderCount,
    p.revenue.toFixed(2),
    p.fees.toFixed(2),
    (p.revenue - p.fees).toFixed(2),
    p.costPerUnit.toFixed(2),
    p.totalCost.toFixed(2),
    p.profit.toFixed(2),
    p.marginPct.toFixed(1) + '%',
    p.stockQty !== null ? p.stockQty : 'N/A',
    p.runRate,
    p.suggestedReorder
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Shopee_Summary_Report_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('ส่งออก CSV สำเร็จ ✓', 'success');
}


// ── Explicit Global Exports ──
window.shopeeSummary = shopeeSummary;
window.initShopeeSummary = initShopeeSummary;
window.switchShopeeSummaryTab = switchShopeeSummaryTab;
window.filterShopeeSummaryPeriod = filterShopeeSummaryPeriod;
window.searchShopeeSummary = searchShopeeSummary;
window.sortShopeeSummaryTable = sortShopeeSummaryTable;
window.filterShopeeSummaryLink = filterShopeeSummaryLink;
window.handleSaveShopeeMapping = handleSaveShopeeMapping;
window.saveShopeeSummaryMapping = saveShopeeSummaryMapping;
window.quickCreatePOFromShopee = quickCreatePOFromShopee;
window.copyShopeeAdsBrief = copyShopeeAdsBrief;
window.copyAIBriefToClipboard = copyAIBriefToClipboard;
window.uploadShopeeSummaryExcel = uploadShopeeSummaryExcel;
window.syncShopeeSummaryToAI = syncShopeeSummaryToAI;
window.exportShopeeSummaryCSV = exportShopeeSummaryCSV;
window.setShopeeAdsFilter = setShopeeAdsFilter;
window.searchShopeeAds = searchShopeeAds;
window.sortShopeeAds = sortShopeeAds;
