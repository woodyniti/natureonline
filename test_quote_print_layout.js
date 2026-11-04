const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html','utf8');
const start = html.indexOf('async function printQuote(');
const end = html.indexOf('async function ',start+1);
const printQuote = html.slice(start,end < 0 ? undefined : end);

assert.ok(start >= 0,'quotation print function exists');
assert.match(printQuote,/\.page-border\{border:0;padding:0/);
assert.match(printQuote,/\.qt-page\{width:100%;min-height:281mm;box-shadow:none;padding:0/);
assert.match(printQuote,/@page\{size:A4 portrait;margin:8mm\}/);
assert.doesNotMatch(printQuote,/corner-tl|corner-tr|corner-bl|corner-br/);
console.log('Quotation A4 print layout: OK');
