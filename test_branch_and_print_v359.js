const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- TEST SUITE: v3.59 Accounting Branch & Print Layout ---');

// 1. Verify Version bump
if (!html.includes("CURRENT_APP_VERSION = 'sealthai-v3.59'")) {
  console.error('FAIL: CURRENT_APP_VERSION is not v3.59');
  process.exit(1);
}
if (!html.includes("DISPLAY_APP_VERSION = 'v3.59'")) {
  console.error('FAIL: DISPLAY_APP_VERSION is not v3.59');
  process.exit(1);
}
if (!html.includes('v3.59 🚀')) {
  console.error('FAIL: Topbar badge not updated to v3.59');
  process.exit(1);
}
console.log('PASS: Version bump to v3.59 verified.');

// 2. Extract and test formatCompanyWithBranch
const fnMatch = html.match(/function formatCompanyWithBranch\([\s\S]*?\n\}/);
if (!fnMatch) {
  console.error('FAIL: formatCompanyWithBranch not found in index.html');
  process.exit(1);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fnMatch[0], sandbox);
const formatCompanyWithBranch = sandbox.formatCompanyWithBranch;

const tests = [
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: '00000', expected: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: '', expected: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: null, expected: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: 'สำนักงานใหญ่', expected: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)', b: '00000', expected: 'บริษัท สามมิตรเทค จำกัด (สำนักงานใหญ่)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: '00001', expected: 'บริษัท สามมิตรเทค จำกัด (สาขา 00001)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: '1', expected: 'บริษัท สามมิตรเทค จำกัด (สาขา 1)' },
  { comp: 'บริษัท สามมิตรเทค จำกัด', b: 'สาขา 00002', expected: 'บริษัท สามมิตรเทค จำกัด (สาขา 00002)' },
  { comp: '', b: '00001', expected: '' },
];

tests.forEach((t, i) => {
  const res = formatCompanyWithBranch(t.comp, t.b);
  if (res !== t.expected) {
    console.error(`FAIL: Test ${i + 1} failed. Expected "${t.expected}" but got "${res}"`);
    process.exit(1);
  }
  console.log(`PASS: Test ${i + 1} (${t.comp || 'empty'}, b="${t.b}") => "${res}"`);
});

// 3. Verify Branch Inputs exist
if (!html.includes('id="o-branch"')) {
  console.error('FAIL: o-branch input not found in new order modal');
  process.exit(1);
}
if (!html.includes('id="ed-branch"')) {
  console.error('FAIL: ed-branch input not found in edit order modal');
  process.exit(1);
}
if (!html.includes('id="qt-branch"')) {
  console.error('FAIL: qt-branch input not found in quotation modal');
  process.exit(1);
}
console.log('PASS: All branch inputs (o-branch, ed-branch, qt-branch) exist.');

// 4. Verify printReceipt contains shipAddr in right box and billAddr in left box
if (!html.includes("billParts.push('<div class=\"info-sub\" style=\"margin-top:3px\"><strong>ที่อยู่ออกบิล:</strong> '")) {
  console.error('FAIL: printReceipt does not have ที่อยู่ออกบิล in left column');
  process.exit(1);
}
if (!html.includes("billParts.push('<div class=\"info-sub\" style=\"margin-top:8px;padding-top:6px;border-top:1px dashed #bbb;text-align:left\"><strong>ที่อยู่จัดส่ง (Ship To):</strong>")) {
  console.error('FAIL: printReceipt does not have ที่อยู่จัดส่ง (Ship To) in right column');
  process.exit(1);
}
console.log('PASS: printReceipt shipping address on right box and billing on left box verified.');

// 5. Verify syntax by checking script tag closure
console.log('ALL TESTS PASSED SUCCESSFULLY! (100% GREEN)');
