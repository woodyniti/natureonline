// test_po_item_internal_note_fallback.js
// Verification of Auto-Fallback for PO Item Internal Note when column internal_note does not exist in Supabase.

const fs = require('fs');
const assert = require('assert');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing PO Item Internal Note Fallback ---');

// 1. Verify helper functions exist
assert(html.includes('function getPOItemNotesFallback('), 'getPOItemNotesFallback function must exist');
assert(html.includes('function noteWithPOItemNotes('), 'noteWithPOItemNotes function must exist');
console.log('✓ 1. getPOItemNotesFallback and noteWithPOItemNotes present');

// 2. Extract and test noteWithPOItemNotes & getPOItemNotesFallback
const startIdx = html.indexOf('function getCleanPONote(note)');
const endIdx = html.indexOf('function getPOExchangeRate(po)');
assert(startIdx > 0 && endIdx > startIdx, 'Could not locate PO note functions block');
const codeBlock = html.substring(startIdx, endIdx);

const context = new Function('window', `
  ${codeBlock}
  return { getPOItemNotesFallback, noteWithPOItemNotes, getCleanPONote };
`)({});

const { getPOItemNotesFallback, noteWithPOItemNotes, getCleanPONote } = context;

// Test A: Round-trip save and extract
const rawNote = 'หมายเหตุใบสั่งซื้อทั่วไป: จัดส่งด่วนพิเศษ';
const notesMap = {
  'item-uuid-1': 'ลูกค้ารอของ 15 วัน',
  'item-uuid-2': 'สต๊อกหมดเกลี้ยง ต้องสั่งด่วน'
};

const updatedNote = noteWithPOItemNotes(rawNote, notesMap);
assert(updatedNote.includes('<!--PO_ITEM_NOTES:'), 'Updated note must contain tag');

const extracted = getPOItemNotesFallback({ note: updatedNote });
assert.strictEqual(extracted['item-uuid-1'], 'ลูกค้ารอของ 15 วัน');
assert.strictEqual(extracted['item-uuid-2'], 'สต๊อกหมดเกลี้ยง ต้องสั่งด่วน');
console.log('✓ Test A: Round-trip fallback note save and extract passed');

// Test B: getCleanPONote strips internal note tag completely
const clean = getCleanPONote(updatedNote);
assert.strictEqual(clean, 'หมายเหตุใบสั่งซื้อทั่วไป: จัดส่งด่วนพิเศษ');
assert(!clean.includes('PO_ITEM_NOTES'), 'Clean note must not leak internal notes');
console.log('✓ Test B: getCleanPONote strips item notes tag from supplier PO');

// Test C: Empty or deleted notes
const deletedMap = { 'item-uuid-1': '' };
const cleanedNote = noteWithPOItemNotes(updatedNote, deletedMap);
const extractedAfterDelete = getPOItemNotesFallback({ note: cleanedNote });
assert(!extractedAfterDelete['item-uuid-1']);
console.log('✓ Test C: Deleting or blanking note updates correctly');

console.log('\nALL PO ITEM INTERNAL NOTE FALLBACK TESTS PASSED! 🎉');
