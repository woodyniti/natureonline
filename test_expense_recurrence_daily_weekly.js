const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function detectExpenseRecurrence(e)');
const end = html.indexOf('\nfunction renderExpenseRecurringAlerts(', start);
assert.ok(start > 0 && end > start);
const context = {
  today: () => '2026-11-08',
  document: { getElementById: id => id === 'exp-month' ? { value: '2026-11' } : context.alertElement },
  effectiveExpenseCategory: e => e.category || 'อื่นๆ',
  alertElement: { innerHTML: '' },
  window: {},
  fmtB: value => '฿' + Number(value).toFixed(2),
  escapeHTML: value => String(value),
  getExpenseCategoryBadge: value => value,
};
vm.runInNewContext(html.slice(start, end), context);
const renderStart = end + 1;
const renderEnd = html.indexOf('\nfunction setExpRecurTab(', renderStart);
vm.runInNewContext(html.slice(renderStart, renderEnd), context);

const weekly = { id:'w1', vendor_name:'Weekly Vendor', category:'บริการ', expense_date:'2026-11-01', due_date:'2026-11-01', payment_status:'paid', base_amount:100, recurrence:'recurring', note:'[recurrence:weekly]' };
const daily = { id:'d1', vendor_name:'Daily Vendor', category:'บริการ', expense_date:'2026-11-07', due_date:'2026-11-07', payment_status:'paid', base_amount:10, recurrence:'recurring', note:'[recurrence:daily]' };
assert.equal(context.detectExpenseRecurrence(weekly), 'weekly');
assert.equal(context.detectExpenseRecurrence(daily), 'daily');
const schedule = context.getRecurringExpenseAlerts([weekly, daily]);
assert.equal(schedule.monthlyList.length, 0, 'weekly/daily entries must not become monthly commitments');
assert.equal(schedule.weeklyList.length, 1);
assert.equal(schedule.dailyList.length, 1);
assert.equal(schedule.weeklyList[0].recurrence, 'weekly');
assert.equal(schedule.dailyList[0].recurrence, 'daily');
context.renderExpenseRecurringAlerts(schedule);
assert.match(context.alertElement.innerHTML, /รายสัปดาห์ \(1\)/);
assert.match(context.alertElement.innerHTML, /รายวัน \(1\)/);
context.window._expRecurTab = 'weekly';
context.renderExpenseRecurringAlerts(schedule);
assert.match(context.alertElement.innerHTML, /Weekly Vendor/);
assert.doesNotMatch(context.alertElement.innerHTML, /Daily Vendor/);
console.log('Expense daily and weekly recurrence scheduling: OK');
