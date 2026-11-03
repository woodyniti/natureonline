const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('function selectDefaultOrderSalesEmployee(');
const end = html.indexOf('// ── หา employee_id',start);
assert.ok(start>0 && end>start);
const context = {DEFAULT_EMP_NAME:'นิติ บุญสายันต์'};
vm.createContext(context);
vm.runInContext(html.slice(start,end),context);

const select = {value:'old-id',options:[
  {value:'',textContent:'-- ไม่ระบุ --'},
  {value:'other-id',textContent:'พนักงานคนอื่น'},
  {value:'niti-id',textContent:'นิติ  บุญสายันต์'}
]};
assert.equal(vm.runInContext('selectDefaultOrderSalesEmployee',context)(select),true);
assert.equal(select.value,'niti-id');
assert.match(html,/await loadEmployeeOptions\('o-emp'\);\s*selectDefaultOrderSalesEmployee\(document\.getElementById\('o-emp'\)\)/);

select.options = select.options.slice(0,2);
assert.equal(vm.runInContext('selectDefaultOrderSalesEmployee',context)(select),false);
assert.equal(select.value,'');
console.log('Default sales employee selection: OK');
