const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const sql = fs.readFileSync('supabase_po_item_internal_note_v316.sql', 'utf8');
assert.match(sql, /ALTER TABLE public\.purchase_order_items[\s\S]*ADD COLUMN IF NOT EXISTS internal_note text/);
assert.match(html, /noteInput\.textContent|noteInput\.value = it\.internal_note \|\| ''/);
assert.match(html, /poItems\[i\]\.internal_note = noteInput\.value/);
assert.match(html, /internal_note: it\.internal_note \|\| ''/);
assert.match(html, /internal_note: poItems\[rowIdx\]\?\.internal_note \|\| ''/);
assert.match(html, /const hasItemNotes = poItems\.some/);
assert.match(html, /select\('internal_note'\)\.limit\(1\)/);
assert.match(html, /\.\.\.\(hasItemNotes \? \{ internal_note:String\(it\.internal_note \|\| ''\)\.trim\(\) \} : \{\}\)/);
assert.match(html, /editPOItemInternalNote\(/);
assert.match(html, /const internalNoteHtml =/);

const save = html.slice(html.indexOf('async function savePO('), html.indexOf('\n// ลบและรวมรายการสินค้าที่ซ้ำใน PO'));
assert.ok(save.indexOf('noteSchemaError') < save.indexOf(".delete().eq('po_id', editingPOId)"), 'schema checked before deleting old PO items');
const printStart = html.indexOf('async function printPO(');
const printEnd = html.indexOf('// AP INVOICE PAGE', printStart);
assert.ok(printStart > 0 && printEnd > printStart);
assert.doesNotMatch(html.slice(printStart, printEnd), /internal_note|internalNote/);
console.log('Private PO item notes and print exclusion: OK');
