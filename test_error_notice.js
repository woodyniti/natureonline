const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
assert.equal((html.match(/function toast\(/g) || []).length, 1, 'one shared toast implementation');
assert.match(html, /#app-error-notice\s*\{[^}]*z-index:2147483647/);
assert.match(html, /window\.addEventListener\('unhandledrejection'/);
assert.match(html, /window\.addEventListener\('error'/);
assert.match(html, /if \(error\) throw error;\s*stockInserted = true;/);
assert.match(html, /if \(receivedErr\) throw receivedErr;/);
assert.match(html, /if \(poStatusErr\) throw poStatusErr;/);
assert.match(html, /โปรดรีเฟรชและตรวจรายการก่อนกดซ้ำ/);

const elements = new Map();
function makeElement(tag) {
  return {
    tag,
    children: [],
    setAttribute() {},
    replaceChildren() { this.children = []; },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); if (child.id) elements.set(child.id, child); },
    remove() { elements.delete(this.id); }
  };
}
const body = makeElement('body');
const context = { document: { body, documentElement: body, createElement: makeElement, getElementById: id => elements.get(id) } };
const start = html.indexOf('function showAppError(');
const end = html.indexOf('\nfunction toast(', start);
vm.runInNewContext(html.slice(start, end), context);
context.showAppError('<server error>');
let notice = elements.get('app-error-notice');
assert.equal(notice.children[1].textContent, '<server error>');
assert.equal(notice.children.length, 3);
context.showAppError('second error');
notice = elements.get('app-error-notice');
assert.equal(notice.children[1].textContent, 'second error');
notice.children[2].onclick();
assert.equal(elements.has('app-error-notice'), false);
console.log('Visible error notice: OK');
