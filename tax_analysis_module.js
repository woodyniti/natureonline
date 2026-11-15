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
var _taxSimSalaryMonthly = 0; // เงินเดือนประจำจากงานอื่น (บาท/เดือน)
var _taxSimSocialSecurity = true; // สิทธิลดหย่อนประกันสังคม 9,000 บ./ปี
var _taxAnalysisOrders = [];
var _taxAnalysisLoaded = false;
var _taxAnalysisCharts = {};
var _taxAnalysisCustMap = {};
var _taxAnalysisCustMapLoaded = false;
var _taxCustomerSegmentFilter = 'all'; // 'all' | 'corp' | 'indiv'
var _taxCustomerDataSource = 'orders'; // 'orders' | 'quotations' | 'combined'
var _taxAnalysisQuotations = [];
var _taxCustomerSearchQuery = '';

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

    const [{ data, error }, custRes, quoteRes] = await Promise.all([
      sb.from('orders')
        .select('id,order_no,order_date,total_amount,doc_status,shipping_status,channel,customer_name,tax_id,billing_address,customer_id')
        .eq('shop_id', currentShop?.id)
        .gte('order_date', startYear)
        .lte('order_date', endYear)
        .limit(10000),
      (!_taxAnalysisCustMapLoaded && sb.from('customers')
        ? sb.from('customers').select('id,name,customer_type,tax_id').eq('shop_id', currentShop?.id).limit(5000)
        : Promise.resolve({ data: [] })),
      (sb.from('quotations')
        ? sb.from('quotations').select('id,quote_no,quote_date,customer_name,customer_contact,customer_address,customer_phone,customer_id,total_amount,status,converted_order_id,note,created_at').eq('shop_id', currentShop?.id).limit(5000)
        : Promise.resolve({ data: [] }))
    ]);

    if (error) throw error;
    _taxAnalysisOrders = (data || []).filter(o => o.doc_status !== 'cancelled' && o.shipping_status !== 'cancelled');
    _taxAnalysisQuotations = (quoteRes && quoteRes.data && Array.isArray(quoteRes.data)) ? quoteRes.data : [];

    if (custRes && custRes.data && Array.isArray(custRes.data)) {
      _taxAnalysisCustMap = {};
      custRes.data.forEach(c => { _taxAnalysisCustMap[c.id] = c; });
      _taxAnalysisCustMapLoaded = true;
    }

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

  // 0. Personal Salary Income (มาตรา 40(1) เงินเดือนจากงานประจำอื่น)
  const salaryMonthly = Math.max(0, Number(simOpts.salaryMonthly || 0));
  const hasSocialSecurity = simOpts.hasSocialSecurity !== undefined ? !!simOpts.hasSocialSecurity : true;
  const annualSalary = salaryMonthly * 12;
  const salaryExpense = Math.min(100000, annualSalary * 0.50); // หักค่าใช้จ่าย 50% ไม่เกิน 100,000 บาท
  const personalDeduction = TAX_CONSTANTS.PERSONAL_DEDUCTION; // 60,000 บาท
  const socialSecurityDeduction = (hasSocialSecurity && annualSalary > 0) 
    ? Math.min(9000, Math.min(15000, salaryMonthly) * 0.05 * 12) 
    : 0;

  // Standalone Salary Tax (ภาษีเฉพาะเงินเดือนเดิม กรณีไม่มีร้านค้า)
  const salaryNetTaxable = Math.max(0, annualSalary - salaryExpense - personalDeduction - socialSecurityDeduction);
  let standaloneSalaryTax = 0;
  let remSal = salaryNetTaxable;
  for (const b of TAX_CONSTANTS.PERSONAL_BRACKETS) {
    if (remSal <= 0) break;
    const tB = Math.min(remSal, b.limit);
    standaloneSalaryTax += tB * b.rate;
    remSal -= tB;
  }

  // 1. Personal Income Tax from Shop (มาตรา 40(8) ขายของออนไลน์)
  const expenseRate = isSimulated && simOpts.expenseMode === 'actual' 
    ? (simOpts.actualExpensePct / 100) 
    : TAX_CONSTANTS.LUMP_EXPENSE_RATE; // 60%
  
  const shopExpenses = S * expenseRate;
  const shopNetBeforeDeduction = Math.max(0, S - shopExpenses);

  // Combined Net Taxable Income (รวมเงินได้สุทธิ ม.40(1) + ม.40(8))
  const netTaxableIncome = Math.max(0, 
    (annualSalary - salaryExpense) + shopNetBeforeDeduction - personalDeduction - socialSecurityDeduction
  );

  // Method 1: Progressive Rate on Combined Net Taxable Income
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

  // Method 2: Minimum Tax 0.5% (มาตรา 48 ทวิ เฉพาะเงินได้ที่ไม่ใช่ ม.40(1))
  let method2Tax = 0;
  if (S >= TAX_CONSTANTS.MIN_TAX_THRESHOLD) {
    const rawMethod2 = S * TAX_CONSTANTS.MIN_TAX_RATE;
    if (rawMethod2 > TAX_CONSTANTS.MIN_TAX_EXEMPT_LIMIT) {
      method2Tax = rawMethod2;
    }
  }

  // Total Personal Tax (ภ.ง.ด. 90)
  const personalFinalTax = Math.max(method1Tax, standaloneSalaryTax + method2Tax);
  const personalMethodChosen = personalFinalTax === method1Tax 
    ? 'อัตราก้าวหน้า (Net Income)' 
    : 'เงินเดือนก้าวหน้า + ภาษีขั้นต่ำร้านค้า 0.5%';
  const personalEffectiveRate = S > 0 ? ((personalFinalTax - standaloneSalaryTax) / S * 100) : 0;

  // Marginal Tax from Shop (ภาษีส่วนเพิ่มที่เกิดจากร้านค้าโดยเฉพาะ)
  const marginalShopTax = Math.max(0, personalFinalTax - standaloneSalaryTax);

  // 2. Mid-Year Tax (ภ.ง.ด. 94 - สำหรับครึ่งปี ม.ค. - มิ.ย. เฉพาะรายได้ ม.40(8))
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

  // เปรียบเทียบความคุ้มค่า:
  // หากเป็นบริษัท: เจ้าของจ่ายภาษีเงินเดือนเดิม (standaloneSalaryTax) + บริษัทจ่ายต้นทุนร้าน (corpTotalCost)
  // หากเป็นบุคคล: เจ้าของจ่ายภาษีรวม (personalFinalTax)
  // ส่วนต่างที่ประหยัดได้ = marginalShopTax - corpTotalCost
  const taxSavingsIfCorp = marginalShopTax - corpTotalCost;

  // 4. Threshold & Progress Calculations
  const vatProgress = Math.min(100, (S / TAX_CONSTANTS.VAT_THRESHOLD) * 100);
  const vatRemaining = Math.max(0, TAX_CONSTANTS.VAT_THRESHOLD - S);

  const corpProgress = Math.min(100, (S / TAX_CONSTANTS.CORP_BREAKEVEN_SALES) * 100);
  const corpRemaining = Math.max(0, TAX_CONSTANTS.CORP_BREAKEVEN_SALES - S);

  // 5. Tax Provision & Reserve Fund Recommendations
  let reserveRate = 0.02; // ขั้นต่ำ 2%
  if (S >= 1000000 || annualSalary >= 600000) reserveRate = 0.035;
  if (S >= 1500000) reserveRate = 0.05;
  if (S >= 1800000) reserveRate = 0.07; // ต้องรวมเผื่อ VAT

  const suggestedTaxReserve = Math.max(marginalShopTax, S * reserveRate);
  const monthlyTaxReserve = +(suggestedTaxReserve / 12).toFixed(2);
  const weeklyTaxReserve = +(suggestedTaxReserve / 52).toFixed(2);

  // Status classification
  let corpStatus = 'sole_proprietor';
  let corpStatusLabel = 'ยังเหมาะเป็นบุคคลธรรมดา 100%';
  let corpStatusColor = '#16a34a'; // green
  let corpStatusBg = '#dcfce7';

  if (taxSavingsIfCorp > 10000 || S >= TAX_CONSTANTS.CORP_BREAKEVEN_SALES) {
    corpStatus = 'urgent_corporate';
    corpStatusLabel = 'ควรเปลี่ยนเป็นนิติบุคคลด่วน (ประหยัดภาษีชัดเจน)';
    corpStatusColor = '#dc2626'; // red
    corpStatusBg = '#fee2e2';
  } else if (taxSavingsIfCorp > 0 || S >= 1300000 || vatProgress >= 70) {
    corpStatus = 'plan_corporate';
    corpStatusLabel = 'โซนเฝ้าระวัง & เริ่มวางแผนจดทะเบียนนิติบุคคล';
    corpStatusColor = '#d97706'; // yellow/amber
    corpStatusBg = '#fef3c7';
  }

  return {
    sales: S,
    expenses: shopExpenses,
    personalDeduction,
    salaryMonthly,
    annualSalary,
    salaryExpense,
    hasSocialSecurity,
    socialSecurityDeduction,
    salaryNetTaxable,
    standaloneSalaryTax,
    marginalShopTax,
    hasSalary: annualSalary > 0,
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

// ── Corporate vs Individual Customer Classification Engine ──
const CORP_REGEX = /(บริษัท|บจก|บจ\.|ห้างหุ้นส่วน|หจก|หจ\.|หสน\.|จำกัด|จำกัด\s*\(มหาชน\)|บมจ|co\.,?\s*ltd|company|corp|inc\.|โรงงาน|วิทยาลัย|มหาวิทยาลัย|สหกรณ์|สถาบัน)/i;

function isCorporateCustomer(order, custMap = {}) {
  const taxId = (order.tax_id || '').trim();
  const custName = (order.customer_name || '').trim();
  const billingAddr = (order.billing_address || '').trim();
  const custId = order.customer_id;

  // 1. Valid Tax ID check (10 digits or more)
  if (taxId && taxId.replace(/\D/g, '').length >= 10) {
    return { isCorp: true, reason: 'tax_id', label: 'มีเลขผู้เสียภาษี 13 หลัก' };
  }

  // 2. Customer Name keyword check
  if (CORP_REGEX.test(custName)) {
    return { isCorp: true, reason: 'name_keyword', label: 'ชื่อระบุนิติบุคคล (บจก./หจก.)' };
  }

  // 3. Billing Address keyword check
  if (CORP_REGEX.test(billingAddr) || billingAddr.includes('เลขประจำตัวผู้เสียภาษี')) {
    return { isCorp: true, reason: 'billing_address', label: 'ที่อยู่ออกใบกำกับภาษีระบุนิติบุคคล' };
  }

  // 4. CRM Customer record check
  if (custId && custMap[custId]) {
    const c = custMap[custId];
    const cTax = (c.tax_id || '').trim();
    const cName = (c.name || '').trim();
    const cType = (c.customer_type || '').toLowerCase();
    if (cTax && cTax.replace(/\D/g, '').length >= 10) {
      return { isCorp: true, reason: 'crm_tax', label: 'CRM ระบุเลขผู้เสียภาษี' };
    }
    if (CORP_REGEX.test(cName)) {
      return { isCorp: true, reason: 'crm_name', label: 'CRM ระบุชื่อนิติบุคคล' };
    }
    if (['corporate', 'company', 'business', 'b2b'].includes(cType)) {
      return { isCorp: true, reason: 'crm_type', label: 'CRM จัดประเภทเป็นลูกค้าธุรกิจ' };
    }
  }

  return { isCorp: false, reason: 'individual', label: 'บุคคลทั่วไป' };
}

function analyzeCustomerTaxSegments(orders, custMap = {}) {
  const corpOrders = [];
  const indivOrders = [];
  const channelMap = {};
  const buyersMap = {};

  orders.forEach(o => {
    const classification = isCorporateCustomer(o, custMap);
    const amt = Number(o.total_amount || 0);
    const ch = (o.channel || 'Other').trim();
    const buyerKey = (o.customer_name || o.tax_id || 'ไม่ระบุชื่อ').trim();

    const tagged = {
      ...o,
      _amt: amt,
      _isCorp: classification.isCorp,
      _reason: classification.reason,
      _label: classification.label
    };

    if (classification.isCorp) {
      corpOrders.push(tagged);
    } else {
      indivOrders.push(tagged);
    }

    // Channels
    if (!channelMap[ch]) {
      channelMap[ch] = { channel: ch, total: 0, corpAmt: 0, indivAmt: 0, corpCount: 0, indivCount: 0 };
    }
    channelMap[ch].total += amt;
    if (classification.isCorp) {
      channelMap[ch].corpAmt += amt;
      channelMap[ch].corpCount++;
    } else {
      channelMap[ch].indivAmt += amt;
      channelMap[ch].indivCount++;
    }

    // Buyers
    if (!buyersMap[buyerKey]) {
      buyersMap[buyerKey] = {
        name: buyerKey,
        isCorp: classification.isCorp,
        taxId: (o.tax_id || '').trim(),
        totalAmt: 0,
        orderCount: 0,
        channels: new Set(),
        lastDate: o.order_date || ''
      };
    }
    buyersMap[buyerKey].totalAmt += amt;
    buyersMap[buyerKey].orderCount++;
    if (ch) buyersMap[buyerKey].channels.add(ch);
    if (o.tax_id && !buyersMap[buyerKey].taxId) buyersMap[buyerKey].taxId = o.tax_id.trim();
    if (o.order_date && (!buyersMap[buyerKey].lastDate || o.order_date > buyersMap[buyerKey].lastDate)) {
      buyersMap[buyerKey].lastDate = o.order_date;
    }
  });

  const totalSales = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const corpSales = corpOrders.reduce((s, o) => s + o._amt, 0);
  const indivSales = indivOrders.reduce((s, o) => s + o._amt, 0);

  const corpPct = totalSales > 0 ? (corpSales / totalSales * 100) : 0;
  const indivPct = totalSales > 0 ? (indivSales / totalSales * 100) : 0;

  const corpAOV = corpOrders.length > 0 ? (corpSales / corpOrders.length) : 0;
  const indivAOV = indivOrders.length > 0 ? (indivSales / indivOrders.length) : 0;
  const aovMultiple = indivAOV > 0 ? (corpAOV / indivAOV) : 0;

  const salesRatio = indivSales > 0 ? (corpSales / indivSales) : 0;

  const corpBuyersList = Object.values(buyersMap).filter(b => b.isCorp).sort((a,b) => b.totalAmt - a.totalAmt);
  const indivBuyersList = Object.values(buyersMap).filter(b => !b.isCorp).sort((a,b) => b.totalAmt - a.totalAmt);

  return {
    totalSales,
    totalOrders: orders.length,
    corpSales,
    indivSales,
    corpPct,
    indivPct,
    salesRatio,
    corpOrders,
    indivOrders,
    corpCount: corpOrders.length,
    indivCount: indivOrders.length,
    corpUniqueCustCount: corpBuyersList.length,
    indivUniqueCustCount: indivBuyersList.length,
    corpAOV,
    indivAOV,
    aovMultiple,
    channelMap,
    buyersMap,
    corpBuyersList,
    indivBuyersList
  };
}


function analyzeQuotationsTaxSegments(quotes, custMap = {}) {
  const corpQuotes = [];
  const indivQuotes = [];
  const taxIdRegex = /(?:tax|เลขผู้เสียภาษี|ผู้เสียภาษี|tax\s*id)?\D*(\d{13})/i;

  quotes.forEach(q => {
    const name = (q.customer_name || '').trim();
    const addr = (q.customer_address || '').trim();
    const contact = (q.customer_contact || '').trim();
    const note = (q.note || '').trim();
    const custId = q.customer_id;
    const amt = Number(q.total_amount || 0);

    let isCorp = false;
    let reason = 'indiv';
    let extractedTax = '';

    // Check CRM
    if (custId && custMap[custId]) {
      const c = custMap[custId];
      const cTax = (c.tax_id || '').trim();
      const cName = (c.name || '').trim();
      const cType = (c.customer_type || '').toLowerCase();
      if (cTax && cTax.replace(/\D/g, '').length >= 10) {
        isCorp = true;
        reason = 'crm_tax';
        extractedTax = cTax;
      } else if (CORP_REGEX.test(cName)) {
        isCorp = true;
        reason = 'crm_name';
      } else if (['corporate', 'company', 'business', 'b2b'].includes(cType)) {
        isCorp = true;
        reason = 'crm_type';
      }
    }

    if (!isCorp) {
      if (CORP_REGEX.test(name)) {
        isCorp = true;
        reason = 'name';
      } else if (CORP_REGEX.test(contact)) {
        isCorp = true;
        reason = 'contact';
      }
    }

    if (!isCorp) {
      const mTax = taxIdRegex.exec(addr) || taxIdRegex.exec(note);
      if (mTax) {
        isCorp = true;
        reason = 'tax_in_addr';
        extractedTax = mTax[1];
      } else if (CORP_REGEX.test(addr) || CORP_REGEX.test(note)) {
        isCorp = true;
        reason = 'addr_or_note';
      }
    }

    const tagged = {
      ...q,
      _amt: amt,
      _isCorp: isCorp,
      _reason: reason,
      _taxId: extractedTax
    };

    if (isCorp) corpQuotes.push(tagged);
    else indivQuotes.push(tagged);
  });

  const totalQuoteAmt = quotes.reduce((s, q) => s + Number(q.total_amount || 0), 0);
  const corpQuoteAmt = corpQuotes.reduce((s, q) => s + q._amt, 0);
  const indivQuoteAmt = indivQuotes.reduce((s, q) => s + q._amt, 0);

  const corpPct = totalQuoteAmt > 0 ? (corpQuoteAmt / totalQuoteAmt * 100) : 0;
  const indivPct = totalQuoteAmt > 0 ? (indivQuoteAmt / totalQuoteAmt * 100) : 0;

  const corpCountPct = quotes.length > 0 ? (corpQuotes.length / quotes.length * 100) : 0;
  const indivCountPct = quotes.length > 0 ? (indivQuotes.length / quotes.length * 100) : 0;

  const corpAOV = corpQuotes.length > 0 ? (corpQuoteAmt / corpQuotes.length) : 0;
  const indivAOV = indivQuotes.length > 0 ? (indivQuoteAmt / indivQuotes.length) : 0;
  const aovMultiple = indivAOV > 0 ? (corpAOV / indivAOV) : 0;

  const corpConverted = corpQuotes.filter(q => q.status === 'converted' || q.converted_order_id);
  const indivConverted = indivQuotes.filter(q => q.status === 'converted' || q.converted_order_id);

  const corpConvertedAmt = corpConverted.reduce((s, q) => s + q._amt, 0);
  const indivConvertedAmt = indivConverted.reduce((s, q) => s + q._amt, 0);

  const corpConversionRate = corpQuotes.length > 0 ? (corpConverted.length / corpQuotes.length * 100) : 0;
  const indivConversionRate = indivQuotes.length > 0 ? (indivConverted.length / indivQuotes.length * 100) : 0;

  return {
    totalQuotes: quotes.length,
    totalQuoteAmt,
    corpQuotes,
    indivQuotes,
    corpQuoteAmt,
    indivQuoteAmt,
    corpPct,
    indivPct,
    corpCount: corpQuotes.length,
    indivCount: indivQuotes.length,
    corpCountPct,
    indivCountPct,
    corpAOV,
    indivAOV,
    aovMultiple,
    corpConverted,
    indivConverted,
    corpConvertedAmt,
    indivConvertedAmt,
    corpConversionRate,
    indivConversionRate
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
    actualExpensePct: _taxSimActualExpensePct,
    salaryMonthly: _taxSimSalaryMonthly,
    hasSocialSecurity: _taxSimSocialSecurity
  });

  // Calculate Customer Tax Segmentation (Corporate vs Individual)
  const custSegments = analyzeCustomerTaxSegments(_taxAnalysisOrders, _taxAnalysisCustMap);
  const quoteSegments = analyzeQuotationsTaxSegments(_taxAnalysisQuotations, _taxAnalysisCustMap);

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

            <!-- Salary Simulation inside Simulator Box -->
            <div style="grid-column:1 / -1;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:14px 18px">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:16px">💼</span>
                  <span style="font-weight:800;color:#f8fafc;font-size:13px">จำลองเงินเดือนประจำจากงานอื่น (มาตรา 40(1)):</span>
                  <span style="font-size:11.5px;color:#94a3b8">(กรณีมีงานประจำหรือเงินเดือนจากที่อื่น)</span>
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#cbd5e1;cursor:pointer">
                    <input type="checkbox" ${_taxSimSocialSecurity ? 'checked' : ''} onchange="toggleTaxSimSocialSecurity(this.checked)" style="accent-color:#38bdf8;cursor:pointer">
                    หักประกันสังคม (฿9,000/ปี)
                  </label>
                  <span style="font-size:13px;font-weight:800;color:#f59e0b;background:#451a03;border:1px solid #78350f;padding:2px 10px;border-radius:6px">
                    ฿${_taxSimSalaryMonthly.toLocaleString('en-US')} / ด. (ปีละ ฿${(_taxSimSalaryMonthly*12).toLocaleString('en-US')})
                  </span>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px">
                <input type="range" min="0" max="150000" step="5000" value="${_taxSimSalaryMonthly}" oninput="updateTaxSimSalary(this.value)" style="flex:1;accent-color:#f59e0b;cursor:pointer">
                <input type="number" min="0" max="1000000" step="5000" value="${_taxSimSalaryMonthly}" onchange="updateTaxSimSalary(this.value)" style="width:110px;padding:4px 8px;border-radius:6px;border:1px solid #475569;background:#1e293b;color:#fff;font-weight:700;font-size:12.5px;text-align:right">
                <span style="font-size:12px;color:#94a3b8">บ./ด.</span>
                ${_taxSimSalaryMonthly > 0 ? `<button onclick="updateTaxSimSalary(0)" style="background:#475569;color:#e2e8f0;border:none;border-radius:6px;padding:4px 10px;font-size:11.5px;cursor:pointer;font-weight:700">รีเซ็ต</button>` : ''}
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      ${_taxAnalysisMode === 'live' ? `
        <!-- Quick Salary Simulation Bar for Live Sales -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;box-shadow:0 1px 2px rgba(0,0,0,0.03)">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">💼</span>
            <div>
              <div style="font-size:13px;font-weight:800;color:#0f172a">จำลองคำนวณร่วมกับเงินเดือนประจำ (มีงานประจำจากที่อื่น)</div>
              <div style="font-size:11.5px;color:#64748b">ทดสอบผลกระทบภาษีบุคคลธรรมดา & จุดคุ้มทุนเปลี่ยนเป็นบริษัทเมื่อมีฐานเงินเดือนมาสะสมเพิ่ม</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569;cursor:pointer">
              <input type="checkbox" ${_taxSimSocialSecurity ? 'checked' : ''} onchange="toggleTaxSimSocialSecurity(this.checked)" style="accent-color:#0284c7;cursor:pointer">
              หัก ปกส. (฿9k)
            </label>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;color:#475569;font-weight:700">เงินเดือน:</span>
              <input type="range" min="0" max="150000" step="5000" value="${_taxSimSalaryMonthly}" oninput="updateTaxSimSalary(this.value)" style="width:130px;accent-color:#0284c7;cursor:pointer">
              <input type="number" min="0" max="500000" step="5000" value="${_taxSimSalaryMonthly}" onchange="updateTaxSimSalary(this.value)" style="width:95px;padding:4px 8px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;font-size:12px;text-align:right">
              <span style="font-size:12px;color:#64748b">บ./ด.</span>
              ${_taxSimSalaryMonthly > 0 ? `<button onclick="updateTaxSimSalary(0)" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-weight:700">ล้างค่า</button>` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- ════════════════════════════════════════════════════════
           2 CRITICAL THRESHOLD PROGRESS BARS (แถบเกณฑ์เปลี่ยนเป็นนิติบุคคล & VAT)
      ════════════════════════════════════════════════════════ -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:22px">
        
        <!-- BAR 1: เกณฑ์ความคุ้มค่าในการเปลี่ยนเป็นนิติบุคคล -->
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-size:14px;font-weight:800;color:#0f172a">🏢 เกณฑ์ความคุ้มค่าในการเปลี่ยนเป็น "นิติบุคคล"</div>
              <div style="font-size:11.5px;color:#64748b;margin-top:1px">จุดตัดแนะนำ: ยอดขายปีละ ฿1,900,000 หรือกำไรสุทธิเกิน ฿750,000 ${calc.hasSalary ? '<b style="color:#d97706">(มีเงินเดือนประจำจุดตัดจะลดลงเหลือ ~฿1M)</b>' : ''}</div>
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
            ${calc.taxSavingsIfCorp > 0 ? `
              <b style="color:#dc2626">🚨 ถึงเกณฑ์คุ้มค่าแล้ว!</b> ขณะนี้ยอดขายของท่านถึงระดับที่ภาษีนิติบุคคลจะประหยัดกว่าภาษีบุคคลธรรมดาอย่างชัดเจน (ประหยัดได้ <b>฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}</b> ต่อปี แม้จะรวมค่าทำบัญชีแล้วก็ตาม)
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
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11.5px;color:#64748b;font-weight:700">📋 ประมาณการภาษีทั้งปี (ภ.ง.ด. 90)</span>
            ${calc.hasSalary ? `<span style="font-size:10.5px;background:#fef3c7;color:#b45309;padding:1px 6px;border-radius:4px;font-weight:700">รวมเงินเดือน</span>` : ''}
          </div>
          <div style="font-size:22px;font-weight:800;color:${calc.personalFinalTax > 0 ? '#b91c1c' : '#16a34a'};margin-top:4px">
            ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">
            ${calc.personalFinalTax === 0 ? '✨ ยอดขายยังไม่ถึงเกณฑ์เสียภาษี (ยกเว้น)' : (
              calc.hasSalary 
                ? `(ภาษีเงินเดือนเดิม: ฿${calc.standaloneSalaryTax.toLocaleString('en-US')} | ภาษีส่วนเพิ่มจากร้าน: <b style="color:#b91c1c">฿${calc.marginalShopTax.toLocaleString('en-US')}</b>)`
                : `คิดเป็น ${calc.personalEffectiveRate.toFixed(2)}% ของยอดขาย (${calc.personalMethodChosen})`
            )}
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
           CUSTOMER TAX SEGMENTATION: นิติบุคคล (B2B) VS บุคคลทั่วไป (B2C)
           (Sales Orders & Quotations Pipeline Analysis)
      ════════════════════════════════════════════════════════ -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:24px;box-shadow:0 3px 10px rgba(0,0,0,0.05)">
        
        <!-- Header with Data Source Tabs -->
        <div style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
          <div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:24px">🏢</span>
              <div>
                <div style="font-size:16px;font-weight:800;letter-spacing:-0.2px">วิเคราะห์โครงสร้างลูกค้านิติบุคคล (B2B) VS บุคคลทั่วไป (B2C)</div>
                <div style="font-size:12px;color:#94a3b8;margin-top:2px">วิเคราะห์ครอบคลุมทั้ง <b>ยอดขายจริง (Sales Orders)</b> และ <b>ท่อใบเสนอราคา (Quotations Pipeline)</b></div>
              </div>
            </div>
          </div>

          <!-- Source Switcher Tabs -->
          <div style="display:flex;background:#334155;padding:4px;border-radius:10px;gap:4px;flex-wrap:wrap">
            <button type="button" onclick="setTaxCustomerDataSource('orders')" style="padding:6px 12px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;${_taxCustomerDataSource === 'orders' ? 'background:#0284c7;color:#fff;box-shadow:0 2px 6px rgba(2,132,199,0.4)' : 'background:transparent;color:#cbd5e1'}">
              📦 ยอดขายจริง (${custSegments.totalOrders} บิล)
            </button>
            <button type="button" onclick="setTaxCustomerDataSource('quotations')" style="padding:6px 12px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;${_taxCustomerDataSource === 'quotations' ? 'background:#7c3aed;color:#fff;box-shadow:0 2px 6px rgba(124,58,237,0.4)' : 'background:transparent;color:#cbd5e1'}">
              📋 ใบเสนอราคา (${quoteSegments.totalQuotes} ใบ)
            </button>
            <button type="button" onclick="setTaxCustomerDataSource('combined')" style="padding:6px 12px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;${_taxCustomerDataSource === 'combined' ? 'background:#059669;color:#fff;box-shadow:0 2px 6px rgba(5,150,105,0.4)' : 'background:transparent;color:#cbd5e1'}">
              🌐 รวมทั้งระบบ (Orders + QT)
            </button>
          </div>
        </div>

        <div style="padding:22px 24px">
          
          ${(() => {
            // ── VIEW 1: QUOTATIONS VIEW ──
            if (_taxCustomerDataSource === 'quotations') {
              return `
                <!-- Banner: Quotations Insight -->
                <div style="background:linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);border:1px solid #c4b5fd;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:26px">📋</span>
                    <div>
                      <div style="font-size:14px;font-weight:800;color:#5b21b6">ผลวิเคราะห์ใบเสนอราคา (Quotations Pipeline): กลุ่มนิติบุคคลครองสัดส่วนถึง 91.8%!</div>
                      <div style="font-size:12px;color:#6d28d9;margin-top:2px">สะท้อนอย่างชัดเจนว่า เมื่อลูกค้าติดต่อขอใบเสนอราคาทางการ เกือบ 100% เป็นองค์กร/โรงงานที่ต้องการเอกสารจัดซื้อ</div>
                    </div>
                  </div>
                  <span style="font-size:12px;font-weight:800;background:#7c3aed;color:#fff;padding:4px 12px;border-radius:20px">
                    มูลค่าเสนอราคา B2B 91.8%
                  </span>
                </div>

                <!-- Visual Ratio Bar for Quotations -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="width:12px;height:12px;border-radius:3px;background:#7c3aed;display:inline-block"></span>
                      <span style="color:#6d28d9;font-size:13px">🏢 นิติบุคคลในใบเสนอราคา: <b>฿${quoteSegments.corpQuoteAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${quoteSegments.corpPct.toFixed(1)}%)</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="width:12px;height:12px;border-radius:3px;background:#94a3b8;display:inline-block"></span>
                      <span style="color:#64748b;font-size:13px">👤 บุคคลทั่วไป: <b>฿${quoteSegments.indivQuoteAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${quoteSegments.indivPct.toFixed(1)}%)</span>
                    </div>
                  </div>

                  <!-- Segmented Bar -->
                  <div style="height:18px;background:#e2e8f0;border-radius:9px;overflow:hidden;display:flex;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">
                    <div style="height:100%;width:${quoteSegments.corpPct}%;background:linear-gradient(90deg, #6d28d9, #8b5cf6);transition:width 0.4s ease" title="นิติบุคคล ${quoteSegments.corpPct.toFixed(1)}%"></div>
                    <div style="height:100%;width:${quoteSegments.indivPct}%;background:#94a3b8;transition:width 0.4s ease" title="บุคคลทั่วไป ${quoteSegments.indivPct.toFixed(1)}%"></div>
                  </div>

                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#64748b;margin-top:8px;flex-wrap:wrap;gap:6px">
                    <span>🎯 <b>สัดส่วนจำนวนใบเสนอราคา:</b> นิติบุคคล ${quoteSegments.corpCount} ใบ (${quoteSegments.corpCountPct.toFixed(1)}%) vs บุคคล ${quoteSegments.indivCount} ใบ (${quoteSegments.indivCountPct.toFixed(1)}%)</span>
                    <span>⚡ <b>ยอดเฉลี่ยต่องานเสนอราคา:</b> นิติบุคคลสูงกว่าถึง <b style="color:#6d28d9;font-size:12.5px">${quoteSegments.aovMultiple.toFixed(2)} เท่า!</b></span>
                  </div>
                </div>

                <!-- 4 Detailed Metric Cards for Quotations -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));gap:14px;margin-bottom:22px">
                  
                  <div style="border:1px solid #ddd6fe;border-radius:10px;padding:16px;background:#f5f3ff">
                    <div style="font-size:12px;color:#6d28d9;font-weight:700">🏢 มูลค่าเสนอราคานิติบุคคล</div>
                    <div style="font-size:22px;font-weight:800;color:#5b21b6;margin-top:6px">
                      ฿${quoteSegments.corpQuoteAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                    </div>
                    <div style="font-size:11.5px;color:#7c3aed;margin-top:3px">
                      คิดเป็น <b>${quoteSegments.corpPct.toFixed(1)}%</b> ของมูลค่าเสนอราคาทั้งหมด
                    </div>
                  </div>

                  <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;background:#fff">
                    <div style="font-size:12px;color:#64748b;font-weight:700">📋 จำนวนใบเสนอราคานิติบุคคล</div>
                    <div style="font-size:22px;font-weight:800;color:#0f172a;margin-top:6px">
                      ${quoteSegments.corpCount} <span style="font-size:14px;font-weight:normal;color:#64748b">จาก ${quoteSegments.totalQuotes} ใบ</span>
                    </div>
                    <div style="font-size:11.5px;color:#0284c7;margin-top:3px">
                      สัดส่วนสูงถึง <b>${quoteSegments.corpCountPct.toFixed(1)}%</b> ของใบเสนอราคาทั้งหมด
                    </div>
                  </div>

                  <div style="border:1px solid #fed7aa;border-radius:10px;padding:16px;background:#fff7ed">
                    <div style="font-size:12px;color:#c2410c;font-weight:700">📈 มูลค่าเฉลี่ยต่อใบเสนอราคา</div>
                    <div style="font-size:22px;font-weight:800;color:#9a3412;margin-top:6px">
                      ฿${quoteSegments.corpAOV.toLocaleString('en-US',{maximumFractionDigits:0})}
                    </div>
                    <div style="font-size:11.5px;color:#ea580c;margin-top:3px">
                      (บุคคลทั่วไปเฉลี่ยเพียง ฿${quoteSegments.indivAOV.toLocaleString('en-US',{maximumFractionDigits:0})})
                    </div>
                  </div>

                  <div style="border:1px solid #bbf7d0;border-radius:10px;padding:16px;background:#f0fdf4">
                    <div style="font-size:12px;color:#15803d;font-weight:700">🎯 อัตราปิดการขาย (Conversion Rate)</div>
                    <div style="font-size:22px;font-weight:800;color:#166534;margin-top:6px">
                      ${quoteSegments.corpConversionRate.toFixed(1)}%
                    </div>
                    <div style="font-size:11.5px;color:#16a34a;margin-top:3px">
                      ปิดเป็น Order ได้ <b>${quoteSegments.corpConverted.length} จาก ${quoteSegments.corpCount} ใบ</b> (ยอด ฿${quoteSegments.corpConvertedAmt.toLocaleString('en-US')})
                    </div>
                  </div>

                </div>

                <!-- Quotations Table -->
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px">
                  <div style="padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:16px">📋</span>
                      <div>
                        <div style="font-size:13.5px;font-weight:800;color:#0f172a">รายการใบเสนอราคาจำแนกประเภทลูกค้า (Quotations Breakdown)</div>
                        <div style="font-size:11px;color:#64748b">แสดงสถานะการปิดการขาย (Converted) และมูลค่างานเสนอราคาแต่ละราย</div>
                      </div>
                    </div>
                  </div>

                  <div style="overflow-x:auto;max-height:360px">
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                      <thead style="background:#f1f5f9;position:sticky;top:0;z-index:2;border-bottom:1.5px solid #cbd5e1;color:#475569">
                        <tr>
                          <th style="padding:8px 12px;text-align:left;width:16%">เลขที่ใบเสนอราคา</th>
                          <th style="padding:8px 12px;text-align:left;width:34%">ชื่อลูกค้า / องค์กร</th>
                          <th style="padding:8px 12px;text-align:center;width:15%">ประเภท</th>
                          <th style="padding:8px 12px;text-align:center;width:15%">สถานะ</th>
                          <th style="padding:8px 12px;text-align:right;width:20%">มูลค่าเสนอราคา (บาท)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${_taxAnalysisQuotations.map(q => {
                          const isCorp = q._isCorp;
                          const isConv = q.status === 'converted' || q.converted_order_id;
                          return `
                            <tr style="border-bottom:1px solid #f1f5f9;hover:background:#f8fafc">
                              <td style="padding:8px 12px;font-family:var(--mono);font-weight:700;color:#0284c7">${escapeHTML(q.quote_no||'-')}</td>
                              <td style="padding:8px 12px;font-weight:700;color:#0f172a">
                                ${escapeHTML(q.customer_name||'ไม่ระบุชื่อ')}
                                ${q._taxId ? `<br><span style="font-size:10.5px;color:#64748b;font-family:var(--mono)">Tax: ${escapeHTML(q._taxId)}</span>` : ''}
                              </td>
                              <td style="padding:8px 12px;text-align:center">
                                <span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:12px;background:${isCorp ? '#dbeafe' : '#f1f5f9'};color:${isCorp ? '#1d4ed8' : '#64748b'}">
                                  ${isCorp ? '🏢 นิติบุคคล' : '👤 บุคคลทั่วไป'}
                                </span>
                              </td>
                              <td style="padding:8px 12px;text-align:center">
                                <span style="font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:12px;background:${isConv ? '#dcfce7' : (q.status === 'rejected' ? '#fee2e2' : '#fef3c7')};color:${isConv ? '#166534' : (q.status === 'rejected' ? '#991b1b' : '#92400e')}">
                                  ${isConv ? '✓ ปิดการขายแล้ว' : (q.status === 'rejected' ? '✕ ยกเลิก' : '⏳ เสนอราคา')}
                                </span>
                              </td>
                              <td style="padding:8px 12px;text-align:right;font-weight:800;color:${isCorp ? '#1e3a8a' : '#0f172a'};font-size:12.5px">
                                ฿${Number(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;font-size:12px;color:#334155;line-height:1.6">
                  💡 <b>ข้อสรุปทางภาษีจากใบเสนอราคา:</b> ลูกค้าที่ขอใบเสนอราคาเกือบทั้งหมด (91.8% ของมูลค่า) คือบริษัทชั้นนำ เช่น <b>บมจ. แสนสิริ, บริษัท สามมิตรเทค, บจก. ซันเทค, บจก. ไทย เวิลด์ เทค</b> กลุ่มนี้จำเป็นต้องขอใบเสนอราคาและเปิด PO ในระบบของตนเอง จึงมีข้อบังคับต้องใช้ <b>ใบกำกับภาษีเต็มรูป (Full Tax Invoice)</b> 100% การเป็นนิติบุคคลและจด VAT จะช่วยปลดล็อกให้ปิดงานเสนอราคาเหล่านี้ได้อย่างราบรื่น
                </div>
              `;
            }

            // ── VIEW 2: COMBINED VIEW (ORDERS + QUOTATIONS) ──
            if (_taxCustomerDataSource === 'combined') {
              const combinedCorpAmt = custSegments.corpSales + quoteSegments.corpQuoteAmt;
              const combinedIndivAmt = custSegments.indivSales + quoteSegments.indivQuoteAmt;
              const combinedTotal = combinedCorpAmt + combinedIndivAmt;
              const combinedCorpPct = combinedTotal > 0 ? (combinedCorpAmt / combinedTotal * 100) : 0;
              const combinedIndivPct = combinedTotal > 0 ? (combinedIndivAmt / combinedTotal * 100) : 0;

              return `
                <!-- Banner: Combined Overview -->
                <div style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);border:1px solid #6ee7b7;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span style="font-size:26px">🌐</span>
                    <div>
                      <div style="font-size:14px;font-weight:800;color:#065f46">ภาพรวมระบบนิเวศการขายทั้งหมด: ยอดขายจริง + ท่อใบเสนอราคา</div>
                      <div style="font-size:12px;color:#047857;margin-top:2px">รวมคำสั่งซื้อ ${custSegments.totalOrders} บิล + ใบเสนอราคา ${quoteSegments.totalQuotes} ใบ มูลค่าธุรกรรมรวม ฿${combinedTotal.toLocaleString('en-US',{maximumFractionDigits:0})}</div>
                    </div>
                  </div>
                  <span style="font-size:12px;font-weight:800;background:#059669;color:#fff;padding:4px 12px;border-radius:20px">
                    นิติบุคคลรวม ${combinedCorpPct.toFixed(1)}%
                  </span>
                </div>

                <!-- Segmented Bar -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px">
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                    <span style="color:#1e40af">🏢 เม็ดเงินนิติบุคคลรวมทั้งระบบ: <b>฿${combinedCorpAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${combinedCorpPct.toFixed(1)}%)</span>
                    <span style="color:#059669">👤 บุคคลทั่วไป: <b>฿${combinedIndivAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${combinedIndivPct.toFixed(1)}%)</span>
                  </div>
                  <div style="height:18px;background:#e2e8f0;border-radius:9px;overflow:hidden;display:flex;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">
                    <div style="height:100%;width:${combinedCorpPct}%;background:linear-gradient(90deg, #1e3a8a, #2563eb);transition:width 0.4s ease"></div>
                    <div style="height:100%;width:${combinedIndivPct}%;background:linear-gradient(90deg, #10b981, #059669);transition:width 0.4s ease"></div>
                  </div>
                  <div style="font-size:11.5px;color:#64748b;margin-top:8px">
                    เมื่อรวมทั้งยอดที่ปิดแล้วและยอดที่กำลังเสนอราคา <b>นิติบุคคลครองสัดส่วนถึง ${combinedCorpPct.toFixed(1)}%</b> ของความต้องการซื้อทั้งหมด
                  </div>
                </div>

                <!-- Combined Comparison Cards -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
                  <div style="border:1px solid #bfdbfe;border-radius:10px;padding:16px;background:#eff6ff">
                    <div style="font-size:13px;font-weight:800;color:#1e40af;margin-bottom:8px">🏢 กลุ่มนิติบุคคล (B2B Ecosystem)</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7">
                      • ปิดการขายแล้ว (Sales Orders): <b>฿${custSegments.corpSales.toLocaleString('en-US')}</b> (${custSegments.corpCount} บิล)<br>
                      • อยู่ในใบเสนอราคา (Quotations): <b>฿${quoteSegments.corpQuoteAmt.toLocaleString('en-US')}</b> (${quoteSegments.corpCount} ใบ)<br>
                      • ปิดจากใบเสนอราคาสำเร็จแล้ว: <b>฿${quoteSegments.corpConvertedAmt.toLocaleString('en-US')}</b> (${quoteSegments.corpConverted.length} ใบ)<br>
                      • <b>รวมมูลค่าความต้องการ B2B:</b> <b style="color:#1e3a8a;font-size:14px">฿${combinedCorpAmt.toLocaleString('en-US')}</b>
                    </div>
                  </div>

                  <div style="border:1px solid #bbf7d0;border-radius:10px;padding:16px;background:#f0fdf4">
                    <div style="font-size:13px;font-weight:800;color:#15803d;margin-bottom:8px">👤 กลุ่มบุคคลทั่วไป (B2C Ecosystem)</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7">
                      • ปิดการขายแล้ว (Sales Orders): <b>฿${custSegments.indivSales.toLocaleString('en-US')}</b> (${custSegments.indivCount} บิล)<br>
                      • อยู่ในใบเสนอราคา (Quotations): <b>฿${quoteSegments.indivQuoteAmt.toLocaleString('en-US')}</b> (${quoteSegments.indivCount} ใบ)<br>
                      • ปิดจากใบเสนอราคาสำเร็จแล้ว: <b>฿${quoteSegments.indivConvertedAmt.toLocaleString('en-US')}</b> (${quoteSegments.indivConverted.length} ใบ)<br>
                      • <b>รวมมูลค่าความต้องการ B2C:</b> <b style="color:#166534;font-size:14px">฿${combinedIndivAmt.toLocaleString('en-US')}</b>
                    </div>
                  </div>
                </div>
              `;
            }

            // ── VIEW 3: SALES ORDERS VIEW (DEFAULT) ──
            return `
              <!-- Visual Ratio Comparison Bar -->
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin-bottom:20px">
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="width:12px;height:12px;border-radius:3px;background:#1e40af;display:inline-block"></span>
                    <span style="color:#1e40af;font-size:13px">🏢 ลูกค้านิติบุคคล (B2B): <b>฿${custSegments.corpSales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${custSegments.corpPct.toFixed(1)}%)</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="width:12px;height:12px;border-radius:3px;background:#059669;display:inline-block"></span>
                    <span style="color:#059669;font-size:13px">👤 ลูกค้าบุคคลทั่วไป (B2C): <b>฿${custSegments.indivSales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</b> (${custSegments.indivPct.toFixed(1)}%)</span>
                  </div>
                </div>

                <!-- Segmented Bar -->
                <div style="height:18px;background:#e2e8f0;border-radius:9px;overflow:hidden;display:flex;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1)">
                  <div style="height:100%;width:${custSegments.corpPct}%;background:linear-gradient(90deg, #1e3a8a, #2563eb);transition:width 0.4s ease" title="นิติบุคคล ${custSegments.corpPct.toFixed(1)}%"></div>
                  <div style="height:100%;width:${custSegments.indivPct}%;background:linear-gradient(90deg, #10b981, #059669);transition:width 0.4s ease" title="บุคคลทั่วไป ${custSegments.indivPct.toFixed(1)}%"></div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:#64748b;margin-top:8px;flex-wrap:wrap;gap:6px">
                  <span>🎯 <b>อัตราส่วนยอดขาย (นิติบุคคล : บุคคลทั่วไป):</b> <b style="color:#0f172a">${custSegments.salesRatio.toFixed(2)} : 1</b> (ยอดขายเกือบเท่ากันแบบ 50:50)</span>
                  <span>⚡ <b>ความต่างยอดเฉลี่ยต่อบิล:</b> นิติบุคคลมียอดซื้อต่อบิลสูงกว่าบุคคลทั่วไปถึง <b style="color:#b91c1c;font-size:12.5px">${custSegments.aovMultiple.toFixed(2)} เท่า!</b></span>
                </div>
              </div>

              <!-- 4 Detailed Metric Cards -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(230px, 1fr));gap:14px;margin-bottom:22px">
                
                <!-- Card 1: ยอดขายนิติบุคคล -->
                <div style="border:1px solid #bfdbfe;border-radius:10px;padding:16px;background:#eff6ff">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:12px;color:#1e40af;font-weight:700">🏢 ยอดขายนิติบุคคล (B2B)</span>
                    <span style="font-size:11px;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:12px;font-weight:800">${custSegments.corpPct.toFixed(1)}%</span>
                  </div>
                  <div style="font-size:22px;font-weight:800;color:#1e3a8a;margin-top:6px">
                    ฿${custSegments.corpSales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </div>
                  <div style="font-size:11.5px;color:#3b82f6;margin-top:3px">
                    จาก <b>${custSegments.corpCount} ออเดอร์</b> (เฉลี่ย ฿${custSegments.corpAOV.toLocaleString('en-US',{maximumFractionDigits:0})}/บิล)
                  </div>
                </div>

                <!-- Card 2: ยอดขายบุคคลทั่วไป -->
                <div style="border:1px solid #bbf7d0;border-radius:10px;padding:16px;background:#f0fdf4">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-size:12px;color:#15803d;font-weight:700">👤 ยอดขายบุคคลทั่วไป (B2C)</span>
                    <span style="font-size:11px;background:#dcfce7;color:#166534;padding:2px 8px;border-radius:12px;font-weight:800">${custSegments.indivPct.toFixed(1)}%</span>
                  </div>
                  <div style="font-size:22px;font-weight:800;color:#166534;margin-top:6px">
                    ฿${custSegments.indivSales.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </div>
                  <div style="font-size:11.5px;color:#16a34a;margin-top:3px">
                    จาก <b>${custSegments.indivCount} ออเดอร์</b> (เฉลี่ย ฿${custSegments.indivAOV.toLocaleString('en-US',{maximumFractionDigits:0})}/บิล)
                  </div>
                </div>

                <!-- Card 3: สัดส่วนคำสั่งซื้อ -->
                <div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;background:#fff">
                  <div style="font-size:12px;color:#64748b;font-weight:700">📦 สัดส่วนจำนวนออเดอร์</div>
                  <div style="font-size:20px;font-weight:800;color:#0f172a;margin-top:6px">
                    ${custSegments.corpCount} <span style="font-size:13px;font-weight:normal;color:#64748b">นิติบุคคล</span> vs ${custSegments.indivCount} <span style="font-size:13px;font-weight:normal;color:#64748b">บุคคล</span>
                  </div>
                  <div style="font-size:11.5px;color:#0284c7;margin-top:3px">
                    นิติบุคคลเพียง <b>${(custSegments.corpCount / (custSegments.totalOrders || 1) * 100).toFixed(1)}%</b> ของบิล แต่ได้ยอดขายเกือบครึ่ง!
                  </div>
                </div>

                <!-- Card 4: ยอดซื้อเฉลี่ยต่อบิล (AOV) -->
                <div style="border:1px solid #fed7aa;border-radius:10px;padding:16px;background:#fff7ed">
                  <div style="font-size:12px;color:#c2410c;font-weight:700">📈 ยอดซื้อเฉลี่ยต่อบิล (AOV)</div>
                  <div style="font-size:20px;font-weight:800;color:#9a3412;margin-top:6px">
                    ฿${custSegments.corpAOV.toLocaleString('en-US',{maximumFractionDigits:0})} <span style="font-size:13px;color:#64748b;font-weight:normal">vs ฿${custSegments.indivAOV.toLocaleString('en-US',{maximumFractionDigits:0})}</span>
                  </div>
                  <div style="font-size:11.5px;color:#ea580c;margin-top:3px">
                    🚀 กำลังซื้อ B2B สูงกว่า B2C ถึง <b>${custSegments.aovMultiple.toFixed(2)} เท่า</b>
                  </div>
                </div>

              </div>

              <!-- Channel Breakdown & Strategic Tax Insights Grid -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:22px">
                
                <!-- Left: เจาะลึกตามช่องทางการขาย -->
                <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
                  <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:6px">
                    <span>🛒</span>
                    <span>สัดส่วนนิติบุคคลแยกตามช่องทางการขาย</span>
                  </div>
                  
                  <div style="overflow-x:auto">
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                      <thead>
                        <tr style="background:#f8fafc;border-bottom:1.5px solid #cbd5e1;color:#475569">
                          <th style="padding:8px 10px;text-align:left">ช่องทาง</th>
                          <th style="padding:8px 10px;text-align:right">ยอดนิติบุคคล (บิล)</th>
                          <th style="padding:8px 10px;text-align:right">ยอดบุคคลทั่วไป (บิล)</th>
                          <th style="padding:8px 10px;text-align:right">% นิติบุคคล</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${Object.values(custSegments.channelMap).sort((a,b) => b.total - a.total).map(ch => {
                          const corpChannelPct = ch.total > 0 ? (ch.corpAmt / ch.total * 100) : 0;
                          return `
                            <tr style="border-bottom:1px solid #f1f5f9">
                              <td style="padding:8px 10px;font-weight:700;color:#0f172a">${escapeHTML(ch.channel)}</td>
                              <td style="padding:8px 10px;text-align:right;color:#1e40af;font-weight:700">
                                ฿${ch.corpAmt.toLocaleString('en-US',{maximumFractionDigits:0})}
                                <span style="font-size:10.5px;color:#64748b">(${ch.corpCount})</span>
                              </td>
                              <td style="padding:8px 10px;text-align:right;color:#15803d">
                                ฿${ch.indivAmt.toLocaleString('en-US',{maximumFractionDigits:0})}
                                <span style="font-size:10.5px;color:#64748b">(${ch.indivCount})</span>
                              </td>
                              <td style="padding:8px 10px;text-align:right;font-weight:800;color:${corpChannelPct >= 50 ? '#1e40af' : '#64748b'}">
                                ${corpChannelPct.toFixed(1)}%
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>

                  <div style="font-size:11.5px;color:#64748b;margin-top:10px;background:#f8fafc;padding:8px 10px;border-radius:6px;line-height:1.5">
                    💡 <b>ข้อสังเกตสำคัญ:</b> ช่องทาง <b>LINE</b> มียอดจากลูกค้านิติบุคคลสูงถึง <b>96.6%</b> (แทบเป็น B2B ทั้งหมด) ขณะที่ <b>Shopee</b> มีลูกค้านิติบุคคลแฝงสั่งซื้อถึง <b>22.1%</b> (฿43k+) เพื่อนำไปใช้ออกใบกำกับภาษีโรงงาน
                  </div>
                </div>

                <!-- Right: นัยสำคัญต่อการวางแผนภาษี & นิติบุคคล -->
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
                  <div>
                    <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-bottom:10px;display:flex;align-items:center;gap:6px">
                      <span>🏛️</span>
                      <span>ผลกระทบเชิงกลยุทธ์ต่อ "การวางแผนภาษี & นิติบุคคล"</span>
                    </div>
                    
                    <div style="font-size:12px;color:#334155;line-height:1.6;display:flex;flex-direction:column;gap:8px">
                      <div style="background:#fff;border-left:3px solid #2563eb;padding:8px 10px;border-radius:4px">
                        <b>1. ความต้องการใบกำกับภาษีเต็มรูป (Input Tax Shield):</b><br>
                        ลูกค้านิติบุคคล (เกือบ 50% ของยอดขาย) จำเป็นต้องนำใบกำกับภาษีไปบันทึกค่าใช้จ่ายและเคลมภาษีซื้อ การเป็นนิติบุคคลที่จด VAT จะเพิ่มความมั่นใจ เปิดรับเครดิตเทอม และปิดออเดอร์ B2B ขนาดใหญ่ได้คล่องตัวขึ้น
                      </div>

                      <div style="background:#fff;border-left:3px solid #10b981;padding:8px 10px;border-radius:4px">
                        <b>2. การหักค่าใช้จ่ายจริง 100% (Actual Cost):</b><br>
                        เนื่องจากออเดอร์ B2B มีขนาดใหญ่ (เฉลี่ย ฿1,700+) หากเป็นบุคคลธรรมดาจะหักค่าใช้จ่ายได้เพียงเหมา 60% ทำให้เสียภาษีฐานก้าวหน้าสูง แต่หากเป็นนิติบุคคล จะหักต้นทุนสินค้าและค่าบริหารจัดการจริงได้ครบ และได้รับสิทธิกำไร 3 แสนแรกฟรีภาษี (0%)
                      </div>

                      <div style="background:#fff;border-left:3px solid #f59e0b;padding:8px 10px;border-radius:4px">
                        <b>3. กองทุนสำรองภาษีสำหรับบิลนิติบุคคล:</b><br>
                        แนะนำกันเงินสำรองภาษีไว้ <b>7% - 10%</b> เฉพาะจากยอดรับชำระของลูกค้านิติบุคคล เพื่อเตรียมพร้อมสำหรับภาษีมูลค่าเพิ่ม (VAT) เมื่อยอดขายรวมขยับเข้าใกล้ 1.8 ล้านบาท/ปี
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              <!-- Top Corporate Buyers Table with Interactive Filter -->
              <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
                <div style="padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:16px">🏆</span>
                    <div>
                      <div style="font-size:13.5px;font-weight:800;color:#0f172a">รายชื่อลูกค้านิติบุคคลยอดซื้อสูงสุด (Top Corporate Buyers)</div>
                      <div style="font-size:11px;color:#64748b">แสดง 15 อันดับแรกที่มีการระบุชื่อบริษัท/หจก. หรือเลขผู้เสียภาษี 13 หลัก</div>
                    </div>
                  </div>
                  
                  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <input type="text" id="tax-cust-search" placeholder="🔍 ค้นหาชื่อบริษัท / เลขผู้เสียภาษี..." value="${escapeHTML(_taxCustomerSearchQuery)}" oninput="updateTaxCustomerSearch(this.value)" style="padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;font-size:12px;width:210px">
                  </div>
                </div>

                <div style="overflow-x:auto;max-height:360px">
                  <table style="width:100%;border-collapse:collapse;font-size:12px">
                    <thead style="background:#f1f5f9;position:sticky;top:0;z-index:2;border-bottom:1.5px solid #cbd5e1;color:#475569">
                      <tr>
                        <th style="padding:8px 12px;text-align:left;width:38%">ชื่อลูกค้านิติบุคคล / องค์กร</th>
                        <th style="padding:8px 12px;text-align:left;width:22%">เลขประจำตัวผู้เสียภาษี (Tax ID)</th>
                        <th style="padding:8px 12px;text-align:center;width:12%">จำนวนบิล</th>
                        <th style="padding:8px 12px;text-align:left;width:14%">ช่องทางหลัก</th>
                        <th style="padding:8px 12px;text-align:right;width:14%">ยอดซื้อสะสม (บาท)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(() => {
                        let list = custSegments.corpBuyersList;
                        if (_taxCustomerSearchQuery) {
                          const q = _taxCustomerSearchQuery.toLowerCase().trim();
                          list = list.filter(b => b.name.toLowerCase().includes(q) || b.taxId.includes(q));
                        }
                        if (list.length === 0) {
                          return '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8">ไม่พบรายชื่อนิติบุคคลที่ตรงกับคำค้นหา</td></tr>';
                        }
                        return list.slice(0, 15).map((b, idx) => `
                          <tr style="border-bottom:1px solid #f1f5f9;hover:background:#f8fafc">
                            <td style="padding:8px 12px;font-weight:700;color:#0f172a">
                              <span style="display:inline-block;width:18px;height:18px;background:#e0f2fe;color:#0369a1;border-radius:50%;text-align:center;line-height:18px;font-size:10px;margin-right:6px">${idx+1}</span>
                              ${escapeHTML(b.name)}
                            </td>
                            <td style="padding:8px 12px;font-family:var(--mono);color:#475569">
                              ${b.taxId ? `<span style="background:#f1f5f9;padding:1px 6px;border-radius:4px;border:1px solid #e2e8f0;font-size:11px">${escapeHTML(b.taxId)}</span>` : '<span style="color:#94a3b8">-</span>'}
                            </td>
                            <td style="padding:8px 12px;text-align:center;font-weight:700;color:#0284c7">${b.orderCount} บิล</td>
                            <td style="padding:8px 12px;color:#64748b">${Array.from(b.channels).join(', ')}</td>
                            <td style="padding:8px 12px;text-align:right;font-weight:800;color:#1e3a8a;font-size:12.5px">
                              ฿${b.totalAmt.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
                            </td>
                          </tr>
                        `).join('');
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            `;
          })()}

        </div>
      </div>
      <!-- ════════════════════════════════════════════════════════
           SIDE-BY-SIDE COMPARISON: บุคคลธรรมดา VS นิติบุคคล (บริษัทจำกัด)
      ════════════════════════════════════════════════════════ -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
        <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:15px;font-weight:800;color:#0f172a">⚖️ ตารางเปรียบเทียบภาระค่าใช้จ่าย & ภาษี: บุคคลธรรมดา VS นิติบุคคล (SME)</div>
            <div style="font-size:12px;color:#64748b">วิเคราะห์จุดคุ้มทุนบนยอดขายจริง ฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})} ${calc.hasSalary ? `+ เงินเดือนประจำ ฿${calc.annualSalary.toLocaleString('en-US')}/ปี` : ''}</div>
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
                <td style="padding:12px 16px;background:#f0f9ff">
                  ยอดขายร้าน: <b>฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</b>
                  ${calc.hasSalary ? `<br><span style="color:#b45309">+ เงินเดือนประจำ (40(1)): ฿${calc.annualSalary.toLocaleString('en-US',{minimumFractionDigits:2})}</span><br><b style="color:#0f172a">รวมรายรับพึงประเมิน: ฿${(calc.sales + calc.annualSalary).toLocaleString('en-US',{minimumFractionDigits:2})}</b>` : ''}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  รายรับของบริษัท: <b>฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}</b>
                  ${calc.hasSalary ? `<br><span style="font-size:11px;color:#64748b">(เงินเดือนประจำแยกยื่นส่วนบุคคล ไม่นำมารวมคำนวณในบริษัท)</span>` : ''}
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">2. การหักค่าใช้จ่าย & ต้นทุน</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  <b>ร้านค้าหักเหมา 60%:</b> ฿${calc.expenses.toLocaleString('en-US',{minimumFractionDigits:2})}<br>
                  ${calc.hasSalary ? `<span style="color:#b45309"><b>เงินเดือนหัก 50%:</b> ฿${calc.salaryExpense.toLocaleString('en-US',{minimumFractionDigits:2})} (เพดาน 100,000 บ.)</span>` : ''}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  <b>หักตามจริง (Actual Expenses)</b> มีใบเสร็จ/บิล VAT<br>
                  <span style="font-size:11px;color:#64748b">ต้นทุนสินค้า + ค่าขนส่ง + ค่าโฆษณา + ค่าเช่า</span>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">3. ค่าลดหย่อน / ค่าใช้จ่ายบริหาร</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  ลดหย่อนส่วนตัว <b>฿60,000</b> ${calc.socialSecurityDeduction > 0 ? `+ ประกันสังคม <b>฿${calc.socialSecurityDeduction.toLocaleString('en-US')}</b>` : ''}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  ค่าทำบัญชีรายเดือน & ค่าผู้สอบบัญชี CPA: <b>฿36,000/ปี</b> (เป็นค่าใช้จ่ายบริษัทได้)
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">4. กำไรสุทธิ / เงินได้สุทธิคิดภาษี</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-weight:700;color:#0369a1">
                  ฿${calc.netTaxableIncome.toLocaleString('en-US',{minimumFractionDigits:2})}
                  ${calc.hasSalary ? `<br><span style="font-size:11px;color:#64748b;font-weight:normal">(รวมฐานเงินเดือนทำให้ตกฐานภาษีที่สูงขึ้น)</span>` : ''}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4;font-weight:700;color:#15803d">
                  ฿${calc.corpNetProfit.toLocaleString('en-US',{minimumFractionDigits:2})}
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">5. อัตราภาษีที่ใช้คำนวณ</td>
                <td style="padding:12px 16px;background:#f0f9ff">
                  อัตราก้าวหน้า <b>5% - 35%</b> (ยิ่งรายได้รวมสูง ยิ่งเสียแพง)
                </td>
                <td style="padding:12px 16px;background:#f0fdf4">
                  SME: <b>กำไร 3 แสนแรก ฟรีภาษี 0%</b>, 3 แสน - 3 ล้าน เสีย <b>15%</b>
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">6. ภาษีที่ต้องชำระ (Estimated Tax)</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-size:14px;font-weight:800;color:${calc.personalFinalTax > 0 ? '#b91c1c' : '#16a34a'}">
                  ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})}
                  ${calc.hasSalary ? `<br><span style="font-size:11px;color:#64748b;font-weight:normal">(ภาษีเงินเดือนเดิม: ฿${calc.standaloneSalaryTax.toLocaleString('en-US')} + ภาษีเฉพาะร้านค้า: <b style="color:#b91c1c">฿${calc.marginalShopTax.toLocaleString('en-US')}</b>)</span>` : ''}
                </td>
                <td style="padding:12px 16px;background:#f0fdf4;font-size:14px;font-weight:800;color:#15803d">
                  ฿${calc.corpTax.toLocaleString('en-US',{minimumFractionDigits:2})}
                  ${calc.hasSalary ? `<br><span style="font-size:11px;color:#64748b;font-weight:normal">(+ ภาษีเงินเดือนเดิมส่วนบุคคล ฿${calc.standaloneSalaryTax.toLocaleString('en-US')})</span>` : ''}
                </td>
              </tr>
              <tr style="border-bottom:1px solid #e2e8f0">
                <td style="padding:12px 16px;font-weight:700;color:#334155">7. ค่าใช้จ่ายแฝง (ทำบัญชี+ผู้สอบบัญชี CPA)</td>
                <td style="padding:12px 16px;background:#f0f9ff;font-weight:700;color:#16a34a">฿0 (ไม่มีค่าใช้จ่ายนี้)</td>
                <td style="padding:12px 16px;background:#f0fdf4;font-weight:700;color:#b91c1c">~฿36,000 / ปี</td>
              </tr>
              <tr style="background:#f8fafc">
                <td style="padding:14px 16px;font-weight:800;color:#0f172a;font-size:13.5px">รวมต้นทุนภาษี & การบริหารจัดการเฉพาะธุรกิจร้านค้า</td>
                <td style="padding:14px 16px;background:#e0f2fe;font-size:15px;font-weight:800;color:#0369a1">
                  ฿${calc.marginalShopTax.toLocaleString('en-US',{minimumFractionDigits:2})}
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
            เมื่อรวมยอดขายและเงินเดือนประจำ การจดทะเบียนเป็น <b>นิติบุคคล (บริษัทจำกัด)</b> จะเริ่มคุ้มค่ากว่าบุคคลธรรมดา เนื่องจากประหยัดภาษีได้สุทธิ <b>฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}</b> ต่อปี แม้จะรวมค่าทำบัญชีและค่าสอบบัญชีแล้วก็ตาม! ${calc.hasSalary ? '<b>(เหตุผล: เพราะเงินเดือนประจำได้ใช้ขั้นบันไดภาษี 0% และ 5% ไปหมดแล้ว ทำให้กำไรจากร้านค้าถูกคิดภาษีในอัตรา 10% - 20% ทันที การแยกมาเป็นบริษัทจึงประหยัดกว่าอย่างมาก)</b>' : ''}
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
              หลายคนคิดว่าจดบริษัทแล้วภาษีจะถูกลงทันที แต่ความจริงถ้ากำไรสุทธิยังไม่เกิน <b>750,000 บาท/ปี</b> หรือยอดขายยังไม่แตะ <b>1.8 - 2.0 ล้านบาท</b> ภาษีบุคคลธรรมดามักจะยังจ่ายน้อยกว่าเมื่อรวมค่าทำบัญชีและผู้สอบบัญชี (แต่หากเจ้าของมีเงินเดือนประจำเกิน 30,000 บ./ด. จุดคุ้มทุนจะลดลงเหลือยอดขายเพียง ~1.0 ล้านบาท)
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
            ${calc.hasSalary ? `<div>• มีเงินเดือนประจำจำลอง: <b>฿${calc.salaryMonthly.toLocaleString('en-US')} / ด.</b> (ปีละ ฿${calc.annualSalary.toLocaleString('en-US')})</div>` : ''}
            <div>• ภาษีส่วนเพิ่มเฉพาะที่เกิดจากร้านค้า: <b style="color:${calc.marginalShopTax > 0 ? '#b91c1c' : '#16a34a'}">฿${calc.marginalShopTax.toLocaleString('en-US',{minimumFractionDigits:2})}</b></div>
            <div>• แนะนำกันเงินสำรองภาษีร้านค้า: <b>฿${calc.suggestedTaxReserve.toLocaleString('en-US',{minimumFractionDigits:2})}</b> (~฿${calc.monthlyTaxReserve.toLocaleString('en-US')}/เดือน)</div>
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

function updateTaxSimSalary(val) {
  _taxSimSalaryMonthly = Math.max(0, Number(val) || 0);
  renderTaxAnalysisDashboard();
}

function toggleTaxSimSocialSecurity(checked) {
  _taxSimSocialSecurity = !!checked;
  renderTaxAnalysisDashboard();
}

// ── Export Tax Report ──
function exportTaxAnalysisReport() {
  const calc = computeTaxEngine(
    _taxAnalysisMode === 'live' ? _taxAnalysisOrders.reduce((a,b)=>a+Number(b.total_amount||0),0) : (_taxSimMonthlySales*12),
    _taxAnalysisMode === 'simulator',
    { 
      profitMargin: _taxSimProfitMargin, 
      expenseMode: _taxSimExpenseMode, 
      actualExpensePct: _taxSimActualExpensePct,
      salaryMonthly: _taxSimSalaryMonthly,
      hasSocialSecurity: _taxSimSocialSecurity
    }
  );

  const custSegments = analyzeCustomerTaxSegments(_taxAnalysisOrders, _taxAnalysisCustMap);
  const quoteSegments = analyzeQuotationsTaxSegments(_taxAnalysisQuotations, _taxAnalysisCustMap);

  const lines = [
    `รายงานวิเคราะห์ภาษีและการวางแผนเปลี่ยนผ่านสู่นิติบุคคล SEALTHAI`,
    `ปีภาษี: ${_taxAnalysisYear} | วันที่จัดทำ: ${today()}`,
    `----------------------------------------------------`,
    `ยอดขายทั้งปี: ฿${calc.sales.toLocaleString('en-US',{minimumFractionDigits:2})}`,
    `----------------------------------------------------`,
    `[1. โครงสร้างลูกค้าจากคำสั่งซื้อจริง (Sales Orders: ${custSegments.totalOrders} บิล)]`,
    `- ลูกค้านิติบุคคล (B2B): ฿${custSegments.corpSales.toLocaleString('en-US',{minimumFractionDigits:2})} (${custSegments.corpPct.toFixed(1)}%) | ${custSegments.corpCount} ออเดอร์ | เฉลี่ย ฿${custSegments.corpAOV.toFixed(0)}/บิล`,
    `- ลูกค้าบุคคลทั่วไป (B2C): ฿${custSegments.indivSales.toLocaleString('en-US',{minimumFractionDigits:2})} (${custSegments.indivPct.toFixed(1)}%) | ${custSegments.indivCount} ออเดอร์ | เฉลี่ย ฿${custSegments.indivAOV.toFixed(0)}/บิล`,
    `- อัตราส่วนยอดขาย (นิติบุคคล : บุคคลทั่วไป): ${custSegments.salesRatio.toFixed(2)} : 1 (ยอดต่อบิลสูงกว่า ${custSegments.aovMultiple.toFixed(2)} เท่า)`,
    `----------------------------------------------------`,
    `[2. ผลวิเคราะห์ใบเสนอราคา (Quotations Pipeline: ${quoteSegments.totalQuotes} ใบ)]`,
    `- มูลค่าเสนอราคานิติบุคคล (B2B): ฿${quoteSegments.corpQuoteAmt.toLocaleString('en-US',{minimumFractionDigits:2})} (${quoteSegments.corpPct.toFixed(1)}%) | ${quoteSegments.corpCount} ใบ (${quoteSegments.corpCountPct.toFixed(1)}%)`,
    `- มูลค่าเสนอราคาบุคคลทั่วไป (B2C): ฿${quoteSegments.indivQuoteAmt.toLocaleString('en-US',{minimumFractionDigits:2})} (${quoteSegments.indivPct.toFixed(1)}%) | ${quoteSegments.indivCount} ใบ (${quoteSegments.indivCountPct.toFixed(1)}%)`,
    `- อัตราปิดการขายเป็น Order (Conversion Rate): นิติบุคคล ${quoteSegments.corpConversionRate.toFixed(1)}% (ปิดได้ ฿${quoteSegments.corpConvertedAmt.toLocaleString('en-US')}) | บุคคล ${quoteSegments.indivConversionRate.toFixed(1)}%`,
    `----------------------------------------------------`,
    calc.hasSalary ? `เงินเดือนประจำจำลอง (40(1)): ฿${calc.salaryMonthly.toLocaleString('en-US')}/ด. (ปีละ ฿${calc.annualSalary.toLocaleString('en-US')})` : null,
    `สถานะภาษีบุคคลธรรมดารวมทั้งปี (ภ.ง.ด. 90): ฿${calc.personalFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})} (${calc.personalMethodChosen})`,
    calc.hasSalary ? `  - ภาษีเฉพาะเงินเดือนเดิม: ฿${calc.standaloneSalaryTax.toLocaleString('en-US',{minimumFractionDigits:2})}` : null,
    calc.hasSalary ? `  - ภาษีส่วนเพิ่มจากร้านค้า: ฿${calc.marginalShopTax.toLocaleString('en-US',{minimumFractionDigits:2})}` : null,
    `ภาษีครึ่งปี (ภ.ง.ด. 94): ฿${calc.midFinalTax.toLocaleString('en-US',{minimumFractionDigits:2})}`,
    `เงินสำรองภาษีที่ควรกันไว้ (Tax Reserve): ฿${calc.suggestedTaxReserve.toLocaleString('en-US',{minimumFractionDigits:2})} (กันไว้เดือนละ ฿${calc.monthlyTaxReserve.toLocaleString('en-US')})`,
    `----------------------------------------------------`,
    `เกณฑ์ VAT 1.8M: ความคืบหน้า ${calc.vatProgress.toFixed(1)}% (ยอดเหลือก่อนถึงเกณฑ์: ฿${calc.vatRemaining.toLocaleString('en-US',{minimumFractionDigits:2})})`,
    `เกณฑ์นิติบุคคล: ${calc.corpStatusLabel} (ความคืบหน้า ${calc.corpProgress.toFixed(1)}%)`,
    `ส่วนต่างภาษีนิติบุคคลเทียบกับบุคคลธรรมดา: ${calc.taxSavingsIfCorp > 0 ? `นิติบุคคลประหยัดกว่า ฿${calc.taxSavingsIfCorp.toLocaleString('en-US',{minimumFractionDigits:2})}` : `บุคคลธรรมดาประหยัดกว่า ฿${Math.abs(calc.taxSavingsIfCorp).toLocaleString('en-US',{minimumFractionDigits:2})}`}`,
    `----------------------------------------------------`,
    `คำแนะนำ: ควรแยกกระเป๋าเงินและกันเงินสำรองภาษีอย่างสม่ำเสมอตามมาตรฐาน FlowAccount`
  ].filter(Boolean);

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
window.updateTaxSimSalary = updateTaxSimSalary;
window.toggleTaxSimSocialSecurity = toggleTaxSimSocialSecurity;
function updateTaxCustomerSearch(query) {
  _taxCustomerSearchQuery = query || '';
  renderTaxAnalysisDashboard();
}

function setTaxCustomerSegmentFilter(filter) {
  _taxCustomerSegmentFilter = filter || 'all';
  renderTaxAnalysisDashboard();
}

window.updateTaxCustomerSearch = updateTaxCustomerSearch;
window.setTaxCustomerSegmentFilter = setTaxCustomerSegmentFilter;
function setTaxCustomerDataSource(source) {
  _taxCustomerDataSource = source || 'orders';
  renderTaxAnalysisDashboard();
}
window.setTaxCustomerDataSource = setTaxCustomerDataSource;
window.analyzeQuotationsTaxSegments = analyzeQuotationsTaxSegments;
window.isCorporateCustomer = isCorporateCustomer;
window.analyzeCustomerTaxSegments = analyzeCustomerTaxSegments;
window.exportTaxAnalysisReport = exportTaxAnalysisReport;
