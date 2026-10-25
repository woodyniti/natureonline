// ══════════════════════════════════════════════════════════════
// ── SEALTHAI v2.75: Tax Analysis & Corporate Transition Module ──
// ── วิเคราะห์ภาษี, แถบเกณฑ์เปลี่ยนเป็นนิติบุคคล & กองทุนสำรองภาษี ──
// ══════════════════════════════════════════════════════════════

var _taxAnalysisYear = new Date().getFullYear();
var _taxAnalysisMode = 'live'; // 'live' | 'simulator'
var _taxSimMonthlySales = 50000;
var _taxSimProfitMargin = 35; // %
var _taxSimExpenseMode = 'lump'; // 'lump' (60%) | 'actual'
var _taxSimActualExpensePct = 65; // %
var _taxAnalysisOrders = [];
var _taxAnalysisLoaded = false;
var _taxAnalysisCharts = {};

// ── Tax Constant Definitions (ตามประมวลรัษฎากรและเกณฑ์ SME) ──
const TAX_CONSTANTS = {
  VAT_THRESHOLD: 1800000,               // 1.8 ล้านบาท เกณฑ์บังคับจด VAT
  CORP_BREAKEVEN_SALES: 1900000,        // ~1.9 ล้านบาท จุดตัดที่ภาษีนิติบุคคลเริ่มประหยัดกว่าบุคคลธรรมดา
  LUMP_EXPENSE_RATE: 0.60,              // มาตรา 40(8) ขายของออนไลน์ หักเหมา 60%
  PERSONAL_DEDUCTION: 60000,            // ลดหย่อนส่วนตัว 60,000 บาท
  MIN_TAX_RATE: 0.005,                  // ภาษีขั้นต่ำ 0.5% (มาตรา 48 ทวิ)
  MIN_TAX_THRESHOLD: 120000,            // ต้องคำนวณขั้นต่ำถ้ารายได้เกิน 120,000 บ.
  MIN_TAX_EXEMPT_LIMIT: 5000,           // ได้รับยกเว้นถ้าภาษีขั้นต่ำคำนวณได้ไม่เกิน 5,000 บ. (ยอดขาย <= 1 ล้าน)
  CORP_BOOKKEEPING_AUDIT_ANNUAL: 36000, // ค่าทำบัญชีรายเดือน (2,000/ด.) + ค่าสอบบัญชี CPA (12,000/ปี) = 36,000 บ./ปี
  PERSONAL_BRACKETS: [
    { limit: 150000, rate: 0.00, label: '0 - 150,000' },
    { limit: 150000, rate: 0.05, label: '150,001 - 300,000' },
    { limit: 200000, rate: 0.10, label: '300,001 - 500,000' },
    { limit: 250000, rate: 0.15, label: '500,001 - 750,000' },
    { limit: 250000, rate: 0.20, label: '750,001 - 1,000,000' },
    { limit: 1000000, rate: 0.25, label: '1,000,001 - 2,000,000' },
    { limit: 3000000, rate: 0.30, label: '2,000,001 - 5,000,000' },
    { limit: Infinity, rate: 0.35, label: 'เกิน 5,000,000 ขึ้นไป' }
  ],
  CORP_SME_BRACKETS: [
    { limit: 300000, rate: 0.00, label: '0 - 300,000 (ยกเว้นภาษี)' },
    { limit: 2700000, rate: 0.15, label: '300,001 - 3,000,000 (15%)' },
    { limit: Infinity, rate: 0.20, label: 'เกิน 3,000,000 (20%)' }
  ]
};

// ── Main Page Entry Point ──
async function taxAnalysis() {
  const topbar = document.getElementById('topbar-actions');
  if (topbar) {
    topbar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <select id="tax-year-selector" onchange="changeTaxYear(this.value)" style="padding:5px 10px;border-radius:6px;border:1px solid var(--border2);background:#fff;font-size:12.5px;font-weight:700">
          <option value="2026" ${_taxAnalysisYear === 2026 ? 'selected' : ''}>ปีภาษี 2569 (2026)</option>
          <option value="2025" ${_taxAnalysisYear === 2025 ? 'selected' : ''}>ปีภาษี 2568 (2025)</option>
        </select>
        <button class="btn btn-secondary btn-sm" onclick="initTaxAnalysis(true)">🔄 รีเฟรชข้อมูล</button>
        <button class="btn btn-secondary btn-sm" onclick="exportTaxAnalysisReport()" style="background:#f0fdf4;color:#166534;border-color:#bbf7d0;font-weight:700">📥 บันทึกรายงานภาษี</button>
      </div>
    `;
  }
  await initTaxAnalysis(false);
}

// ── Initialize and Load Store Data ──
async function initTaxAnalysis(forceReload = false) {
  const pageContent = document.getElementById('page-content');
  if (!_taxAnalysisLoaded || forceReload) {
    if (pageContent) {
      pageContent.innerHTML = `
        <div style="text-align:center;padding:60px 20px">
          <div class="spinner" style="margin:0 auto 16px auto"></div>
          <div style="font-size:16px;font-weight:700;color:var(--text)">กำลังวิเคราะห์ยอดขายและประมวลผลภาษี...</div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">คำนวณฐานภาษีบุคคลธรรมดา ภ.ง.ด. 90/94 เปรียบเทียบนิติบุคคล และเกณฑ์ภาษีมูลค่าเพิ่ม</div>
        </div>
      `;
    }
  }

  try {
    // 1. Fetch Orders from Supabase
    const yStr = String(_taxAnalysisYear);
    const startYear = `${yStr}-01-01`;
    const endYear = `${yStr}-12-31`;

    const { data, error } = await sb.from('orders')
      .select('id,order_no,order_date,total_amount,doc_status,shipping_status,channel')
      .eq('shop_id', currentShop?.id)
      .gte('order_date', startYear)
      .lte('order_date', endYear)
      .limit(10000);

    if (error) throw error;
    _taxAnalysisOrders = (data || []).filter(o => o.doc_status !== 'cancelled' && o.shipping_status !== 'cancelled');

  } catch (err) {
    console.warn('Tax orders fetch error, falling back to local preloaded:', err);
    // Fallback: check window.SHOPEE_PRELOADED_ORDERS
    if (window.SHOPEE_PRELOADED_ORDERS && Array.isArray(window.SHOPEE_PRELOADED_ORDERS)) {
      _taxAnalysisOrders = window.SHOPEE_PRELOADED_ORDERS.map(o => ({
        id: o.orderId,
        order_date: o.orderDate,
        total_amount: o.netSale || o.dealPrice * o.qty,
        channel: 'Shopee'
      }));
    }
  }

  _taxAnalysisLoaded = true;
  renderTaxAnalysisDashboard();
}

// ── Tax Computation Engine ──
function computeTaxEngine(salesAmount, isSimulated = false, simOpts = {}) {
  const S = Math.max(0, salesAmount);

  // 1. Personal Income Tax (มาตรา 40(8))
  const expenseRate = isSimulated && simOpts.expenseMode === 'actual' 
    ? (simOpts.actualExpensePct / 100) 
    : TAX_CONSTANTS.LUMP_EXPENSE_RATE; // 60%
  
  const expenses = S * expenseRate;
  const personalDeduction = TAX_CONSTANTS.PERSONAL_DEDUCTION; // 60,000
  const netTaxableIncome = Math.max(0, S - expenses - personalDeduction);

  // Method 1: Progressive Rate
  let method1Tax = 0;
  let remainingNet = netTaxableIncome;
  const bracketBreakdown = [];

  for (const b of TAX_CONSTANTS.PERSONAL_BRACKETS) {
    if (remainingNet <= 0) break;
    const taxableInBracket = Math.min(remainingNet, b.limit);
    const taxInBracket = taxableInBracket * b.rate;
    method1Tax += taxInBracket;
    bracketBreakdown.push({
      range: b.label,
      rate: b.rate * 100,
      taxable: taxableInBracket,
      tax: taxInBracket
    });
    remainingNet -= taxableInBracket;
  }

  // Method 2: Minimum Tax 0.5%
  let method2Tax = 0;
  if (S >= TAX_CONSTANTS.MIN_TAX_THRESHOLD) {
    const rawMethod2 = S * TAX_CONSTANTS.MIN_TAX_RATE;
    if (rawMethod2 > TAX_CONSTANTS.MIN_TAX_EXEMPT_LIMIT) {
      method2Tax = rawMethod2;
    }
  }

  const personalFinalTax = Math.max(method1Tax, method2Tax);
  const personalMethodChosen = personalFinalTax === method1Tax ? 'อัตราก้าวหน้า (Net Income)' : 'ภาษีขั้นต่ำ 0.5% (เงินได้พึงประเมิน)';
  const personalEffectiveRate = S > 0 ? (personalFinalTax / S * 100) : 0;

  // 2. Mid-Year Tax (ภ.ง.ด. 94 - สำหรับครึ่งปี ม.ค. - มิ.ย.)
  const midYearSales = S * 0.5;
  const midExpenses = midYearSales * expenseRate;
  const midDeduction = personalDeduction * 0.5; // ลดหย่อนครึ่งปี 30,000
  const midNet = Math.max(0, midYearSales - midExpenses - midDeduction);
  
  let midMethod1 = 0;
  let remMid = midNet;
  for (const b of TAX_CONSTANTS.PERSONAL_BRACKETS) {
    if (remMid <= 0) break;
    const tB = Math.min(remMid, b.limit);
    midMethod1 += tB * b.rate;
    remMid -= tB;
  }
  const midFinalTax = midMethod1;

  // 3. Corporate Income Tax (SME Company)
  // Estimated profit margin: if simulated use simOpts.profitMargin, else assume ~25%
  const profitMargin = isSimulated ? (simOpts.profitMargin / 100) : 0.25;
  const corpGrossProfit = S * profitMargin;
  const corpBookkeepingCost = TAX_CONSTANTS.CORP_BOOKKEEPING_AUDIT_ANNUAL; // 36,000/year
  const corpNetProfit = Math.max(0, corpGrossProfit - corpBookkeepingCost);

  let corpTax = 0;
  const corpBreakdown = [];
  let remCorp = corpNetProfit;
  for (const b of TAX_CONSTANTS.CORP_SME_BRACKETS) {
    if (remCorp <= 0) break;
    const tB = Math.min(remCorp, b.limit);
    const taxInBracket = tB * b.rate;
    corpTax += taxInBracket;
    corpBreakdown.push({
      range: b.label,
      rate: b.rate * 100,
      taxable: tB,
      tax: taxInBracket
    });
    remCorp -= tB;
  }
  const corpTotalCost = corpTax + corpBookkeepingCost;
  const taxSavingsIfCorp = personalFinalTax - corpTotalCost;

  // 4. Threshold & Progress Calculations
  const vatProgress = Math.min(100, (S / TAX_CONSTANTS.VAT_THRESHOLD) * 100);
  const vatRemaining = Math.max(0, TAX_CONSTANTS.VAT_THRESHOLD - S);

  const corpProgress = Math.min(100, (S / TAX_CONSTANTS.CORP_BREAKEVEN_SALES) * 100);
  const corpRemaining = Math.max(0, TAX_CONSTANTS.CORP_BREAKEVEN_SALES - S);

  // 5. Tax Provision & Reserve Fund Recommendations
  // แนะนำการกันเงินสำรองภาษี
  let reserveRate = 0.02; // ขั้นต่ำ 2%
  if (S >= 1000000) reserveRate = 0.035;
  if (S >= 1500000) reserveRate = 0.05;
  if (S >= 1800000) reserveRate = 0.07; // ต้องรวมเผื่อ VAT

  const suggestedTaxReserve = Math.max(personalFinalTax, S * reserveRate);
  const monthlyTaxReserve = +(suggestedTaxReserve / 12).toFixed(2);
  const weeklyTaxReserve = +(suggestedTaxReserve / 52).toFixed(2);

  // Status classification
  let corpStatus = 'sole_proprietor';
  let corpStatusLabel = 'ยังเหมาะเป็นบุคคลธรรมดา 100%';
  let corpStatusColor = '#16a34a'; // green
  let corpStatusBg = '#dcfce7';

  if (S >= TAX_CONSTANTS.CORP_BREAKEVEN_SALES || taxSavingsIfCorp > 10000) {
    corpStatus = 'urgent_corporate';
    corpStatusLabel = 'ควรเปลี่ยนเป็นนิติบุคคลด่วน (ประหยัดภาษีชัดเจน)';
    corpStatusColor = '#dc2626'; // red
    corpStatusBg = '#fee2e2';
  } else if (S >= 1300000 || vatProgress >= 70) {
    corpStatus = 'plan_corporate';
    corpStatusLabel = 'โซนเฝ้าระวัง & เริ่มวางแผนจดทะเบียนนิติบุคคล';
    corpStatusColor = '#d97706'; // yellow/amber
    corpStatusBg = '#fef3c7';
  }

  return {
    sales: S,
    expenses,
    personalDeduction,
    netTaxableIncome,
    method1Tax,
    method2Tax,
    personalFinalTax,
    personalMethodChosen,
    personalEffectiveRate,
    bracketBreakdown,
    midFinalTax,
    corpGrossProfit,
    corpNetProfit,
    corpBookkeepingCost,
    corpTax,
    corpTotalCost,
    taxSavingsIfCorp,
    vatProgress,
    vatRemaining,
    corpProgress,
    corpRemaining,
    reserveRate,
    suggestedTaxReserve,
    monthlyTaxReserve,
    weeklyTaxReserve,
    corpStatus,
    corpStatusLabel,
    corpStatusColor,
    corpStatusBg
  };
}

// ── Render Full Dashboard ──
function renderTaxAnalysisDashboard() {
  const container = document.getElementById('page-content');
  if (!container) return;

  // 1. Calculate actual revenue per month and year
  const monthlyMap = {};
  for (let m = 1; m <= 12; m++) {
    const k = `${_taxAnalysisYear}-${String(m).padStart(2, '0')}`;
    monthlyMap[k] = { month: k, revenue: 0, orderCount: 0 };
  }

  let totalActualSales = 0;
  _taxAnalysisOrders.forEach(o => {
    const d = (o.order_date || '').slice(0, 7);
    const amt = Number(o.total_amount || 0);
    totalActualSales += amt;
    if (monthlyMap[d]) {
      monthlyMap[d].revenue += amt;
      monthlyMap[d].orderCount++;
    }
  });

  const activeSales = _taxAnalysisMode === 'live' 
    ? totalActualSales 
    : (_taxSimMonthlySales * 12);

  const calc = computeTaxEngine(activeSales, _taxAnalysisMode === 'simulator', {
    profitMargin: _taxSimProfitMargin,
    expenseMode: _taxSimExpenseMode,
    actualExpensePct: _taxSimActualExpensePct
  });

  // Calculate monthly average for active period
  const monthsWithSales = Object.values(monthlyMap).filter(m => m.revenue > 0).length || 1;
  const avgMonthlyActual = totalActualSales / monthsWithSales;

  container.innerHTML = `
    <div style="max-width:1240px;margin:0 auto;padding-bottom:50px">

      <!-- Header & Mode Switcher -->
      <div style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);color:#fff;border-radius:14px;padding:24px 28px;margin-bottom:20px;box-shadow:0 4px 14px rgba(15,23,42,0.15)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:26px">🏛️</span>
              <div>
                <h2 style="margin:0;font-size:20px;font-weight:800;letter-spacing:-0.3px">ศูนย์วิเคราะห์ภาษี & วางแผนเปลี่ยนผ่านสู่นิติบุคคล</h2>
                <div style="font-size:12.5px;color:#94a3b8;margin-top:2px">ประเมินภาระภาษีบุคคลธรรมดา (ภ.ง.ด. 90/94) · จุดคุ้มทุนเปลี่ยนเป็นบริษัท · เกณฑ์ VAT 1.8M · สำรองเงินภาษี</div>
              </div>
            </div>
          </div>
          
          <!-- Mode Tabs -->
          <div style="display:flex;background:#334155;padding:4px;border-radius:10px;gap:4px">
            <button onclick="setTaxMode('live')" style="padding:6px 14px;border-radius:7px;border:none;cursor:pointer;font-size:12.5px;font-weight:700;transition:all 0.2s;${_taxAnalysisMode === 'live' ? 'background:#0284c7;color:#fff;box-shadow:0 2px 6px rgba(2,132,199,0.4)' : 'background:transparent;color:#94a3b8'}">
              📊 ข้อมูลจริงจากร้านค้า (Live Sales)
            </button>
            <button onclick="setTaxMode('simulator')" style="padding:6px 14px;border-radius:7px;border:none;cursor:pointer;font-size:12.5px;font-weight:700;transition:all 0.2s;${_taxAnalysisMode === 'simulator' ? 'background:#0284c7;color:#fff;box-shadow:0 2px 6px rgba(2,132,199,0.4)' : 'background:transparent;color:#94a3b8'}">
              🎮 จำลองยอดขาย (Tax Simulator)
            </button>
          </div>
        </div>

        ${_taxAnalysisMode === 'simulator' ? `
          <!-- Simulator Controls Box -->
          <div style="background:#1e293b;border:1px solid #475569;border-radius:10px;padding:16px 20px;margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:16px;align-items:center">
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
                <span style="color:#cbd5e1">ยอดขายที่คาดการณ์ต่อเดือน:</span>
                <span style="font-weight:800;color:#38bdf8;font-size:14px">฿${_taxSimMonthlySales.toLocaleString('en-US')} / ด. (ปีละ ฿${(_taxSimMonthlySales*12).toLocaleString('en-US')})</span>
              </div>
              <input type="range" min="20000" max="600000" step="10000" value="${_taxSimMonthlySales}" oninput="updateTaxSimSales(this.value)" style="width:100%;accent-color:#38bdf8;cursor:pointer">
            </div>

            <div>
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
                <span style="color:#cbd5e1">อัตรากำไรสุทธิประเมิน (Net Profit Margin):</span>
                <span style="font-weight:800;color:#4ade80;font-size:14px">${_taxSimProfitMargin}%</span>
              </div>
              <input type="range" min="10" max="60" step="5" value="${_taxSimProfitMargin}" oninput="updateTaxSimMargin(this.value)" style="width:100%;accent-color:#4ade80;cursor:pointer">
            </div>

            <div>
              <div style="font-size:12px;color:#cbd5e1;margin-bottom:6px">วิธีหักค่าใช้จ่ายบุคคลธรรมดา:</div>
              <div style="display:flex;gap:8px">
                <button type="button" onclick="setTaxSimExpense('lump')" style="flex:1;padding:6px;border-radius:6px;font-size:11.5px;font-weight:700;border:1px solid ${_taxSimExpenseMode==='lump'?'#38bdf8':'#475569'};background:${_taxSimExpenseMode==='lump'?'#0369a1':'#334155'};color:#fff;cursor:pointer">
                  หักเหมา 60%
                </button>
                <button type="button" onclick="setTaxSimExpense('actual')" style="flex:1;padding:6px;border-radius:6px;font-size:11.5px;font-weight:700;border:1px solid ${_taxSimExpenseMode==='actual'?'#38bdf8':'#475569'};background:${_taxSimExpenseMode==='actual'?'#0369a1':'#334155'};color:#fff;cursor:pointer">
                  ตามจริง ${_taxSimActualExpensePct}%
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- ════════════════════════════════════════════════════════
           2 CRITICAL THRESHOLD PROGRESS BARS (แถบเกณฑ์เปลี่ยนเป็นนิติบุคคล & VAT)
      ════════════════════════════════════════════════════════ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px">
        
        <!-- BAR 1: เกณฑ์ความคุ้มค่าในการเปลี่ยนเป็นนิติบุคคล -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:800;color:#0f172a">🏢 เกณฑ์ความคุ้มค่าในการเปลี่ยนเป็น "นิติบุคคล"</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:1px">จุดตัดแนะนำ: ยอดขายปีละ ฿1,900,000 หรือกำไรสุทธิเกิน ฿750,000</div>
            </div>
            <span style="font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${calc.corpStatusBg};color:${calc.corpStatusColor}">
              ${calc.corpStatusLabel}
            </span>
          </div>

          <!-- Progress Bar -->
          <div style="margin:16px 0 8px 0">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px">
              <span>ยอดขายสะสม: <b>฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></span>
              <span style="color:#0284c7">${calc.corpProgress.toFixed(1)}%</span>
            </div>
            <div style="height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden;position:relative">
              <div style="height:100%;width:${calc.corpProgress}%;background:${calc.corpProgress >= 100 ? '#dc2626' : (calc.corpProgress >= 70 ? '#f59e0b' : '#10b981')};border-radius:7px;transition:width 0.4s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:6px">
              <span>฿0 (เริ่มต้น)</span>
              <span>฿1.3M (เริ่มเตรียมตัว)</span>
              <span>฿1.9M (จุดคุ้มทุนเปลี่ยนเป็นบริษัท)</span>
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;color:#475569;margin-top:12px;line-height:1.5">
            ${calc.corpProgress >= 100 ? `
              <b style="color:#dc2626">🚨 ถึงเกณฑ์แล้ว!</b> ขณะนี้ยอดขายของท่านถึงระดับที่ภาษีนิติบุคคลจะประหยัดกว่าภาษีบุคคลธรรมดาอย่างชัดเจน (ประหยัดได้ <b>฿${Math.max(0, calc.taxSavingsIfCorp).toLocaleString('en-US',{minimumFractionDigits:2})}</b> ต่อปี แม้จะรวมค่าทำบัญชีแล้วก็ตาม)
            ` : (calc.corpProgress >= 70 ? `
              <b style="color:#d97706">⚠️ โซนเฝ้าระวัง:</b> ยอดขายของท่านเข้าใกล้จุดคุ้มทุน ควรเริ่มศึกษาและเตรียมความพร้อมในการจดทะเบียนบริษัท (เช่น เตรียมผู้ถือหุ้น 2 คน, เตรียมเอกสารสถานที่)
            ` : `
              <b style="color:#16a34a">✓ สรุปคำแนะนำ:</b> ตอนนี้ยังเหมาะทำในรูปแบบ <b>บุคคลธรรมดา</b> คล่องตัวกว่า ภาระภาษียังไม่สูง และยังไม่คุ้มค่าทำบัญชี/สอบบัญชีปีละ ฿36,000 (ยังห่างจากจุดคุ้มทุนอีก <b>฿${calc.corpRemaining.toLocaleString('en-US',{minimumFractionDigits:2})}</b>)
            `)}
          </div>
        </div>

        <!-- BAR 2: เกณฑ์ภาษีมูลค่าเพิ่ม (VAT 1.8 ล้านบาท) -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:800;color:#0f172a">🧾 เกณฑ์ภาษีมูลค่าเพิ่ม (VAT 7%) กรมสรรพากร</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:1px">เกณฑ์บังคับตามกฎหมาย: รายได้เกิน ฿1,800,000 ต่อปี ต้องจด VAT ภายใน 30 วัน</div>
            </div>
            <span style="font-size:11.5px;font-weight:800;padding:3px 10px;border-radius:20px;background:${calc.vatProgress >= 100 ? '#fee2e2' : (calc.vatProgress >= 75 ? '#fef3c7' : '#dcfce7')};color:${calc.vatProgress >= 100 ? '#dc2626' : (calc.vatProgress >= 75 ? '#d97706' : '#16a34a')}">
              ${calc.vatProgress >= 100 ? '🚨 ต้องจด VAT 7%' : (calc.vatProgress >= 75 ? '⚠️ ใกล้แตะเกณฑ์ VAT' : '🟢 ปลอดภัย (ยังไม่ต้องจด VAT)')}
            </span>
          </div>

          <!-- Progress Bar -->
          <div style="margin:16px 0 8px 0">
            <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px">
              <span>ยอดขายสะสม: <b>฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></span>
              <span style="color:#0284c7">${calc.vatProgress.toFixed(1)}%</span>
            </div>
            <div style="height:14px;background:#f1f5f9;border-radius:7px;overflow:hidden;position:relative">
              <div style="height:100%;width:${calc.vatProgress}%;background:${calc.vatProgress >= 100 ? '#dc2626' : (calc.vatProgress >= 75 ? '#f59e0b' : '#38bdf8')};border-radius:7px;transition:width 0.4s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-top:6px">
              <span>฿0 (เริ่มต้น)</span>
              <span>฿1,350,000 (เตือนล่วงหน้า 75%)</span>
              <span>฿1,800,000 (เพดานยกเว้น VAT)</span>
            </div>
          </div>

          <div style="background:#f8fafc;border-radius:8px;padding:10px 12px;font-size:12px;color:#475569;margin-top:12px;line-height:1.5">
            ${calc.vatProgress >= 100 ? `
              <b style="color:#dc2626">🚨 คำเตือนสำคัญ:</b> ยอดขายของท่านเกิน 1.8 ล้านบาทแล้ว! มีหน้าที่ตามประมวลรัษฎากรต้องยื่นแบบ ภ.พ.01 เพื่อจดทะเบียนภาษีมูลค่าเพิ่มภายใน 30 วันนับแต่วันที่ยอดเกิน หากละเลยจะมีโทษปรับและเงินเพิ่ม
            ` : `
              <b>ความจุยอดขายที่ยังทำได้โดยไม่ต้องจด VAT:</b> ยังมียอดขายเหลืออีก <b>฿${calc.vatRemaining.toLocaleString('en-US',{minimumFractionDigits:2})}</b> ตลอดปีภาษีนี้ จึงจะถึงเกณฑ์บังคับจด VAT
            `}
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════
           KPI CARDS: ภาษีปัจจุบัน & การกันเงินสำรอง
      ════════════════════════════════════════════════════════ -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;margin-bottom:22px">
        
        <!-- Card 1: ยอดขายปีนี้ -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:11.5px;color:#64748b;font-weight:700">💰 ยอดขายอ้างอิงตลอดปี ${_taxAnalysisYear}</div>
          <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:4px">฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
          <div style="font-size:11px;color:#0284c7;margin-top:3px">${_taxAnalysisMode==='live'?`จากคำสั่งซื้อจริง ${_taxAnalysisOrders.length} ออเดอร์`:'โหมดจำลองยอดขาย'}</div>
        </div>

        <!-- Card 2: ภาษีบุคคลธรรมดาทั้งปี (ภ.ง.ด. 90) -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:11.5px;color:#64748b;font-weight:700">📋 ประมาณการภาษีทั้งปี (ภ.ง.ด. 90)</div>
          <div style="font-size:22px;font-weight:800;color:${calc.personalFinalTax > 0 ? '#b91c1c' : '#16a34a'};margin-top:4px">
            ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">
            ${calc.personalFinalTax === 0 ? '✨ ยอดขายยังไม่ถึงเกณฑ์เสียภาษี (ยกเว้น)' : `คิดเป็น ${calc.personalEffectiveRate.toFixed(2)}% ของยอดขาย (${calc.personalMethodChosen})`}
          </div>
        </div>

        <!-- Card 3: ภาษีครึ่งปี (ภ.ง.ด. 94) -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:11.5px;color:#64748b;font-weight:700">🗓️ ภาษีครึ่งปี ม.ค. - มิ.ย. (ภ.ง.ด. 94)</div>
          <div style="font-size:22px;font-weight:800;color:#0369a1;margin-top:4px">
            ฿${calc.midFinalTax.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">ยื่นช่วง ก.ค. - ก.ย. (นำไปหักภาษีปลายปีได้)</div>
        </div>

        <!-- Card 4: กองทุนสำรองภาษีที่ต้องกันไว้ -->
        <div style="background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);border:1px solid #86efac;border-radius:10px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,0.04)">
          <div style="font-size:11.5px;color:#15803d;font-weight:800">🛡️ เงินสำรองภาษีที่ควรกันไว้ (Tax Reserve)</div>
          <div style="font-size:22px;font-weight:800;color:#166534;margin-top:4px">
            ฿${calc.suggestedTaxReserve.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style="font-size:11px;color:#15803d;margin-top:3px">
            <b>แนะนำกันไว้ ${(calc.reserveRate*100).toFixed(1)}%</b> (~฿${calc.monthlyTaxReserve.toLocaleString('en-US')}/เดือน)
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════
           SIDE-BY-SIDE COMPARISON: บุคคลธรรมดา VS นิติบุคคล (บริษัทจำกัด)
      ════════════════════════════════════════════════════════ -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
        <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a">⚖️ ตารางเปรียบเทียบภาระค่าใช้จ่าย & ภาษี: บุคคลธรรมดา VS นิติบุคคล (SME)</div>
            <div style="font-size:12px;color:#64748b">วิเคราะห์จุดคุ้มทุนบนยอดขายจริง ฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
          </div>
          <div style="font-size:12px;font-weight:700;color:${calc.taxSavingsIfCorp > 0 ? '#15803d' : '#b45309'};background:${calc.taxSavingsIfCorp > 0 ? '#dcfce7' : '#fef3c7'};padding:4px 12px;border-radius:20px">
            ${calc.taxSavingsIfCorp > 0 ? `✨ นิติบุคคลประหยัดกว่าปีละ ฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}` : `✨ บุคคลธรรมดาประหยัดกว่าปีละ ฿${Math.abs(calc.taxSavingsIfCorp).toLocaleString('en-US',{minimumFractionDigits:2})}`}
          </div>
        </div>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead style="background:#f1f5f9;border-bottom:2px solid #cbd5e1">
              <tr>
                <th style="padding:12px 16px;text-align:left;color:#334155;width:28%">มิติการเปรียบเทียบ</th>
                <th style="padding:12px 16px;text-align:left;color:#0369a1;background:#f0f9ff;width:36%">👤 บุคคลธรรมดา (ปัจจุบัน)</th>
                <th style="padding:12px 16px;text-align:left;color:#15803d;background:#f0fdf4;width:36%">🏢 นิติบุคคล / บริษัทจำกัด (SME)</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">1. ยอดขายทั้งปี (รายรับรวม)</td>
                <td style="padding:12px 16px;background:#f0f9ff">฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                <td style="padding:12px 16px;background:#f0fdf4">฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">2. การหักค่าใช้จ่าย & ต้นทุน</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  <b>หักเหมา 60%</b> (ไม่ต้องมีบิล)<br>
                  <span style="font-size:11px;color:#64748b">หักได้: ฿${calc.expenses.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  <b>หักตามจริง (Actual Expenses)</b> มีใบเสร็จ/บิล VAT<br>
                  <span style="font-size:11px;color:#64748b">ต้นทุนสินค้า + ค่าขนส่ง + ค่าโฆษณา + ค่าเช่า</span>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">3. ค่าลดหย่อน / ค่าใช้จ่ายบริหาร</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  ลดหย่อนส่วนตัว <b>฿60,000</b> (เงินได้สุทธิ: ฿${calc.netTaxableIncome.toLocaleString('en-US',{minimumFractionDigits:2})})
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  ค่าทำบัญชีรายเดือน & ค่าผู้สอบบัญชี CPA: <b>฿36,000/ปี</b> (เป็นค่าใช้จ่ายบริษัทได้)
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">4. กำไรสุทธิสำหรับคิดภาษี</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-weight:700;color:#0369a1">
                  ฿${calc.netTaxableIncome.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4;font-weight:700;color:#15803d">
                  ฿${calc.corpNetProfit.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">5. อัตราภาษีที่ใช้คำนวณ</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  อัตราก้าวหน้า <b>5% - 35%</b> (ยิ่งรายได้สูง ยิ่งเสียแพง)
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  SME: <b>กำไร 3 แสนแรก ฟรีภาษี 0%</b>, 3 แสน - 3 ล้าน เสีย <b>15%</b>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">6. ภาษีที่ต้องชำระ (Estimated Tax)</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-size:14px;font-weight:800;color:${calc.personalFinalTax > 0 ? '#b91c1c' : '#16a34a'}">
                  ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4;font-size:14px;font-weight:800;color:#15803d">
                  ฿${calc.corpTax.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">7. ค่าใช้จ่ายแฝง (ทำบัญชี+ผู้สอบบัญชี CPA)</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-weight:700;color:#16a34a">฿0 (ไม่มีค่าใช้จ่ายนี้)</td>
                <td style="padding:12px 16px;background:#f0fdf4;font-weight:700;color:#b91c1c">~฿36,000 / ปี</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:14px 16px;font-weight:800;color:#0f172a;font-size:13.5px">รวมต้นทุนภาษี & การบริหารจัดการ</td>
                <td style="padding:14px 16px;background:#e0f2fe;font-size:15px;font-weight:800;color:#0369a1">
                  ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
                <td style="padding:14px 16px;background:#dcfce7;font-size:15px;font-weight:800;color:#15803d">
                  ฿${calc.corpTotalCost.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12.5px;color:#334155;line-height:1.6">
          💡 <b>บทสรุปความคุ้มค่า:</b> ${calc.taxSavingsIfCorp > 0 ? `
            เมื่อยอดขายอยู่ที่ระดับนี้ การจดทะเบียนเป็น <b>นิติบุคคล (บริษัทจำกัด)</b> จะเริ่มคุ้มค่ากว่าบุคคลธรรมดา เนื่องจากประหยัดภาษีได้สุทธิ <b>฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}</b> ต่อปี แม้จะรวมค่าทำบัญชีและค่าสอบบัญชีแล้วก็ตาม!
          ` : `
            ณ ยอดขายปัจจุบัน การคงสถานะเป็น <b>บุคคลธรรมดา</b> ยังคงประหยัดกว่านิติบุคคลถึง <b>฿${Math.abs(calc.taxSavingsIfCorp).toLocaleString('en-US',{minimumFractionDigits:2})}</b> ต่อปี เพราะบุคคลธรรมดามีภาระภาษีต่ำมาก และไม่ต้องเสียค่าทำบัญชี/ค่าผู้สอบบัญชีปีละ ฿36,000!
          `}
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════
           7 CRUCIAL CONSIDERATIONS (อ้างอิง FlowAccount Blog & สรรพากร)
      ════════════════════════════════════════════════════════ -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#0f172a">📖 7 ข้อคิดสำคัญก่อนจดทะเบียนนิติบุคคล (บริษัทจำกัด)</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px">วิเคราะห์ความพร้อมตามมาตรฐาน FlowAccount & กรมพัฒนาธุรกิจการค้า (DBD)</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.open('https://flowaccount.com/blog/7-crucial-considerations-before-business-registration/','_blank')">
            🔗 อ่านบทความฉบับเต็ม FlowAccount ↗
          </button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:14px">
          
          <!-- Item 1 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">1</span>
              <span>เช็กความคุ้มค่าเรื่องภาษี (Tax Viability)</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              หลายคนคิดว่าจดบริษัทแล้วภาษีจะถูกลงทันที แต่ความจริงถ้ากำไรสุทธิยังไม่เกิน <b>750,000 บาท/ปี</b> หรือยอดขายยังไม่แตะ <b>1.8 - 2.0 ล้านบาท</b> ภาษีบุคคลธรรมดามักจะยังจ่ายน้อยกว่าเมื่อรวมค่าทำบัญชีและผู้สอบบัญชี
            </div>
          </div>

          <!-- Item 2 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">2</span>
              <span>จำนวนผู้ถือหุ้นขั้นต่ำ (กฎหมายใหม่: 2 คนขึ้นไป)</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              ปัจจุบันประมวลกฎหมายแพ่งฯ กำหนดให้จัดตั้งบริษัทจำกัดต้องมีผู้เริ่มก่อการหรือผู้ถือหุ้นอย่างน้อย <b>2 คน</b> (ลดลงจากเดิม 3 คน) ต้องมีคนร่วมถือหุ้นที่ไว้ใจได้ เช่น หุ้นส่วน หรือคนในครอบครัว
            </div>
          </div>

          <!-- Item 3 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">3</span>
              <span>ทุนจดทะเบียน & การชำระค่าหุ้นขั้นต่ำ 25%</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              ทุนจดทะเบียนมาตรฐานที่นิยมคือ <b>1,000,000 บาท</b> (สร้างความน่าเชื่อถือกับโรงงาน/คู่ค้า B2B) โดยกฎหมายกำหนดให้ต้องมีการเรียกชำระค่าหุ้นเบื้องต้นอย่างน้อย <b>25% (250,000 บาท)</b> เพื่อเข้าบัญชีบริษัท
            </div>
          </div>

          <!-- Item 4 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">4</span>
              <span>การตั้งชื่อ & จองชื่อนิติบุคคล</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              ชื่อบริษัทต้องไม่ซ้ำหรือคล้ายคลึงกับนิติบุคคลอื่น และต้องจองชื่อผ่านระบบ DBD e-Registration ของกรมพัฒนาธุรกิจการค้า โดยชื่อที่ได้รับการอนุมัติจะมีอายุ 30 วัน
            </div>
          </div>

          <!-- Item 5 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">5</span>
              <span>สถานที่ตั้งสำนักงาน & เอกสารยินยอม</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              ต้องมีทะเบียนบ้านของสถานที่ตั้งชัดเจน หากใช้บ้านของตนเองหรือเช่า ต้องมีหนังสือยินยอมให้ใช้เป็นที่ตั้งสำนักงานใหญ่ และหากอนาคตต้องจด VAT สถานที่ต้องรองรับการตรวจสอบของสรรพากรพื้นที่
            </div>
          </div>

          <!-- Item 6 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">6</span>
              <span>ภาระผูกพันทางบัญชี & ค่าใช้จ่ายประจำปี</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              เมื่อเป็นบริษัทแล้ว <b>กฎหมายบังคับ</b> ให้ต้องมีผู้ทำบัญชีส่งงบ ยื่นภาษีหัก ณ ที่จ่าย (ภ.ง.ด. 1, 3, 53) ทุกเดือน และต้องมีผู้สอบบัญชีรับอนุญาต (CPA/TA) ตรวจสอบงบปี มีค่าใช้จ่ายคงที่ปีละ <b>฿35,000 - ฿60,000</b>
            </div>
          </div>

          <!-- Item 7 -->
          <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;background:#f8fafc;grid-column:1 / -1">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;color:#0f172a;font-size:13px">
              <span style="background:#0284c7;color:#fff;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px">7</span>
              <span>การจดบริษัท กับ การจด VAT เป็นคนละเรื่องกัน!</span>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:8px;line-height:1.5">
              แม้จะจดเป็นบริษัทแล้ว หากรายได้ยังไม่เกิน <b>1.8 ล้านบาทต่อปี</b> กฎหมายก็ยังไม่บังคับให้ต้องจด VAT 7% เว้นแต่ต้องการออกใบกำกับภาษีเต็มรูปให้ลูกค้าโรงงาน/องค์กร B2B เพื่อสร้างโอกาสทางการค้า
            </div>
          </div>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════
           TAX RESERVE PLANNING & ACTIONABLE RECOMMENDATIONS
      ════════════════════════════════════════════════════════ -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
        <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:12px">
          💡 แผนปฏิบัติการ: จำเป็นต้องกันเงินเตรียมเสียภาษีไหม & ต้องกันอย่างไร?
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
          <div style="font-size:12.5px;color:#334155;line-height:1.6">
            <div style="font-weight:700;color:#0284c7;margin-bottom:6px">📌 ข้อเท็จจริงสำหรับร้าน SEALTHAI ตอนนี้:</div>
            <div>• ยอดขายปี ${_taxAnalysisYear} ปัจจุบันอยู่ที่ <b>฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</b></div>
            <div>• หลังจากหักค่าใช้จ่ายเหมา 60% และลดหย่อนส่วนตัว 60,000 บาท เงินได้สุทธิยังอยู่ในเกณฑ์ <b>ได้รับการยกเว้นภาษี (0 บาท)</b></div>
            <div>• แต่หากช่วงปลายปีมียอดขายเติบโตขึ้น หรือรวมยอดขายจากทุกมาร์เก็ตเพลสจนเกิน 5-6 แสนบาท จะเริ่มมีภาษีต้องจ่ายประมาณ ฿2,000 - ฿7,500</div>
          </div>

          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;font-size:12.5px;color:#166534;line-height:1.6">
            <div style="font-weight:800;margin-bottom:6px">🎯 แนวทางปฏิบัติที่ดีที่สุด (Best Practice):</div>
            <div>1. <b>เปิดบัญชีธนาคารแยกเฉพาะ 1 บัญชี:</b> ตั้งชื่อเป็น "กองทุนภาษีร้าน (Tax Reserve Account)"</div>
            <div>2. <b>กันเงินสำรอง ${(calc.reserveRate*100).toFixed(1)}% ของยอดรับเข้าทุกสัปดาห์:</b> เช่น หากสัปดาห์นี้รับเงินโอน ฿20,000 ให้โอนเก็บเข้าบัญชีภาษี <b>฿${(20000 * calc.reserveRate).toFixed(0)}</b> ทันที</div>
            <div>3. เมื่อถึงกำหนดยื่นแบบ ภ.ง.ด. 94 (กันยายน) หรือ ภ.ง.ด. 90 (มีนาคม) จะมีเงินสดพร้อมจ่ายทันทีโดยไม่กระทบกระแสเงินสดหมุนเวียนของร้าน</div>
          </div>
        </div>
      </div>

    </div>
  `;
}

// ── Interactive Controller Functions ──
function setTaxMode(mode) {
  _taxAnalysisMode = mode;
  renderTaxAnalysisDashboard();
}

function changeTaxYear(y) {
  _taxAnalysisYear = Number(y);
  initTaxAnalysis(true);
}

function updateTaxSimSales(val) {
  _taxSimMonthlySales = Number(val);
  renderTaxAnalysisDashboard();
}

function updateTaxSimMargin(val) {
  _taxSimProfitMargin = Number(val);
  renderTaxAnalysisDashboard();
}

function setTaxSimExpense(mode) {
  _taxSimExpenseMode = mode;
  renderTaxAnalysisDashboard();
}

// ── Export Tax Report ──
function exportTaxAnalysisReport() {
  const calc = computeTaxEngine(
    _taxAnalysisMode === 'live' ? _taxAnalysisOrders.reduce((a,b)=>a+Number(b.total_amount||0),0) : (_taxSimMonthlySales*12),
    _taxAnalysisMode === 'simulator',
    { profitMargin: _taxSimProfitMargin, expenseMode: _taxSimExpenseMode, actualExpensePct: _taxSimActualExpensePct }
  );

  const lines = [
    `รายงานวิเคราะห์ภาษีและการวางแผนเปลี่ยนผ่านสู่นิติบุคคล SEALTHAI`,
    `ปีภาษี: ${_taxAnalysisYear} | วันที่จัดทำ: ${today()}`,
    `----------------------------------------------------`,
    `ยอดขายทั้งปี: ฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}`,
    `สถานะภาษีบุคคลธรรมดา (ภ.ง.ด. 90): ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})} (${calc.personalMethodChosen})`,
    `ภาษีครึ่งปี (ภ.ง.ด. 94): ฿${calc.midFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})}`,
    `เงินสำรองภาษีที่ควรกันไว้ (Tax Reserve): ฿${calc.suggestedTaxReserve.toLocaleString('en-US',{minimumFractionDigits:2})} (กันไว้เดือนละ ฿${calc.monthlyTaxReserve.toLocaleString('en-US')})`,
    `----------------------------------------------------`,
    `เกณฑ์ VAT 1.8M: ความคืบหน้า ${calc.vatProgress.toFixed(1)}% (ยอดเหลือก่อนถึงเกณฑ์: ฿${calc.vatRemaining.toLocaleString('en-US',{minimumFractionDigits:2})})`,
    `เกณฑ์นิติบุคคล: ${calc.corpStatusLabel} (ความคืบหน้า ${calc.corpProgress.toFixed(1)}%)`,
    `ส่วนต่างภาษีนิติบุคคลเทียบกับบุคคลธรรมดา: ${calc.taxSavingsIfCorp > 0 ? `นิติบุคคลประหยัดกว่า ฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}` : `บุคคลธรรมดาประหยัดกว่า ฿${Math.abs(calc.taxSavingsIfCorp).toLocaleString('en-US',{minimumFractionDigits:2})}`}`,
    `----------------------------------------------------`,
    `คำแนะนำ: ควรแยกกระเป๋าเงินและกันเงินสำรองภาษีอย่างสม่ำเสมอตามมาตรฐาน FlowAccount`
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SEALTHAI_Tax_Analysis_${_taxAnalysisYear}_${today()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('ส่งออกรายงานสรุปภาษีเรียบร้อย ✓', 'success');
}

// ── Explicit Global Exports ──
window.taxAnalysis = taxAnalysis;
window.initTaxAnalysis = initTaxAnalysis;
window.setTaxMode = setTaxMode;
window.changeTaxYear = changeTaxYear;
window.updateTaxSimSales = updateTaxSimSales;
window.updateTaxSimMargin = updateTaxSimMargin;
window.setTaxSimExpense = setTaxSimExpense;
window.exportTaxAnalysisReport = exportTaxAnalysisReport;
