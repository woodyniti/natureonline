/**
 * ═══════════════════════════════════════════════════════════════════════
 * SEALTHAI AI BOT SERVER (LINE OA @sealthai & Telegram Admin Webhook)
 * Version: v1.38+
 * Description: Production-ready Node.js server connecting LINE OA & Telegram
 *              to PostgreSQL/Supabase database & AI Substitution Engine.
 * ═══════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());

// Configuration from Environment Variables
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
const DEFAULT_SHOP_ID = process.env.DEFAULT_SHOP_ID || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── 1. Helper: AI Substitution Engine ────────────────────────────────
async function evaluateItemSubstitution(sealType, specText, qty = 1, material = 'NBR', appType = 'Static Seal') {
  // Query Products
  const { data: prods } = await supabase
    .from('products')
    .select('*')
    .eq('active', true);

  const allProducts = prods || [];

  // Query Approved Substitutes Memory
  const { data: approvedSubs } = await supabase
    .from('approved_substitutes')
    .select('*');

  const approvedList = approvedSubs || [];

  // 1. Check Approved Substitute Memory
  const mem = approvedList.find(s => s.requested_spec.toLowerCase().includes(specText.toLowerCase()));
  if (mem) {
    const p = allProducts.find(x => x.sku === mem.substitute_sku || x.name === mem.substitute_name);
    if (p) {
      return {
        status: 'approved_substitute',
        product: p,
        notes: `สินค้าเทียบมาตรฐานที่เคยอนุมัติแล้ว (${mem.application_condition})`,
        price: calculatePrice(p, qty, sealType)
      };
    }
  }

  // 2. Exact Match Check
  if (sealType === 'O-Ring') {
    const m = specText.match(/(\d+(?:\.\d+)?)[xX*×\s-](\d+(?:\.\d+)?)/);
    if (m) {
      const id = parseFloat(m[1]), cs = parseFloat(m[2]);
      const exact = allProducts.find(p => {
        const n = p.name.toUpperCase();
        return n.includes('O-RING') && n.includes(String(id)) && n.includes(String(cs)) && n.includes(material.toUpperCase());
      });

      if (exact && Number(exact.stock_qty || 0) > 0) {
        return {
          status: 'exact',
          product: exact,
          notes: `ตรงขนาด 100% สต็อก ${exact.stock_qty} วง`,
          price: calculatePrice(exact, qty, 'O-Ring')
        };
      }

      // Check Substitute candidate (CS same or ±0.2, ID diff <= 3%)
      const cand = allProducts.filter(p => p.name.toUpperCase().includes('O-RING') && p.name.toUpperCase().includes(material.toUpperCase()))
        .map(p => {
          const pm = p.name.match(/(\d+(?:\.\d+)?)[xX*×\s-](\d+(?:\.\d+)?)/);
          if (!pm) return null;
          const cId = parseFloat(pm[1]), cCs = parseFloat(pm[2]);
          const idDiffPct = Math.abs(cId - id) / id * 100;
          const csDiff = Math.abs(cCs - cs);
          return { prod: p, cId, cCs, idDiffPct, csDiff };
        })
        .filter(Boolean)
        .filter(c => c.csDiff <= 0.3 && c.idDiffPct <= 5.0 && Number(c.prod.stock_qty || 0) > 0)
        .sort((a,b) => a.csDiff - b.csDiff || a.idDiffPct - b.idDiffPct);

      if (cand.length > 0) {
        const best = cand[0];
        const isStaticReady = (idDiffPct <= 3.0 && best.csDiff <= 0.25);
        return {
          status: isStaticReady ? 'substitute_static' : 'needs_admin_approval',
          product: best.prod,
          notes: `ขนาดเทียบ ${best.cId}×${best.cCs} (ID ต่าง ${best.idDiffPct.toFixed(2)}%, CS ${best.cCs} มม.) สต็อก ${best.prod.stock_qty} วง`,
          price: calculatePrice(best.prod, qty, 'O-Ring')
        };
      }
    }
  } else if (sealType === 'Oil Seal') {
    // TC can substitute SC, TB -> SB, TA -> SA
    const m = specText.match(/\b(tc|sc|tb|sb|ta|sa)\b[\s:-]*(\d+)[\s*xX×-]+(\d+)[\s*xX×-]+(\d+)/i);
    if (m) {
      const type = m[1].toUpperCase(), id = m[2], od = m[3], thk = m[4];
      let subType = type === 'SC' ? 'TC' : (type === 'SB' ? 'TB' : (type === 'SA' ? 'TA' : type));
      const match = allProducts.find(p => p.name.toUpperCase().includes(subType) && p.name.includes(id) && p.name.includes(od) && p.name.includes(thk) && Number(p.stock_qty || 0) > 0);
      if (match) {
        return {
          status: 'substitute_static',
          product: match,
          notes: `ใช้ ${subType} แทน ${type} ได้ (เพิ่มปากกันฝุ่น) สต็อก ${match.stock_qty} ชิ้น`,
          price: calculatePrice(match, qty, 'Oil Seal')
        };
      }
    }
  }

  return { status: 'not_found', product: null, notes: 'ไม่พบสินค้าในระบบ หรือสินค้าหมดสต๊อก', price: 0 };
}

function calculatePrice(product, qty, sealType) {
  const priceMax = Number(product.price_max || product.sale_price || 20);
  if (sealType === 'O-Ring') {
    if (qty >= 50) return Math.round(priceMax * 1.30);
    return Math.round(priceMax * 2.00);
  }
  return Math.round(priceMax * 2.00);
}

// ── 2. LINE OA Webhook Endpoint ──────────────────────────────────────
app.post('/webhook/line', async (req, res) => {
  res.status(200).send('OK');
  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMsg = event.message.text.trim();
      const replyToken = event.replyToken;
      const userId = event.source.userId;

      try {
        // Quick greeting response
        if (userMsg.match(/^(สวัสดี|hello|hi|ดีครับ|ดีค่ะ)/i) && !userMsg.match(/\d+[xX*×\s]\d+/)) {
          await replyLineMessage(replyToken, 'สวัสดีค่ะ Sealthai ยินดีให้บริการค่ะ 🙏✨\nท่านสามารถแจ้งชื่อรุ่น หรือขนาดโอริง/ออยซีล/ไฮดรอลิก เช่น 14x2.5 หรือ TC 25 40 7 เพื่อให้ระบบเช็คราคาและสต็อกได้ทันทีค่ะ');
          continue;
        }

        // Parse O-Ring or Seal spec
        const oringMatch = userMsg.match(/(\d+(?:\.\d+)?)[xX*×/ -](\d+(?:\.\d+)?)/);
        const oilSealMatch = userMsg.match(/\b(tc|sc|tb|sb|ta|sa)\b[\s:-]*(\d+)[\s*xX×-]+(\d+)[\s*xX×-]+(\d+)/i);

        let sealType = 'O-Ring';
        let specText = userMsg;
        let qty = 10;

        const qtyMatch = userMsg.match(/(\d+)\s*(?:ตัว|วง|ชิ้น|เส้น|ชุด)/);
        if (qtyMatch) qty = parseInt(qtyMatch[1], 10);

        if (oilSealMatch) {
          sealType = 'Oil Seal';
        }

        const evalRes = await evaluateItemSubstitution(sealType, specText, qty);

        if (evalRes.status === 'exact' || evalRes.status === 'approved_substitute' || evalRes.status === 'substitute_static') {
          const p = evalRes.product;
          const unitPrice = evalRes.price;
          const subtotal = unitPrice * qty;
          const discText = (sealType === 'O-Ring' && qty < 50 && subtotal > 500) ? ' (ยอดเกิน 500 บาท ลดพิเศษ 15%)' : '';
          const finalTotal = (sealType === 'O-Ring' && qty < 50 && subtotal > 500) ? Math.round(subtotal * 0.85) : subtotal;

          let reply = `📦 รายการสินค้า: ${p.name}\n` +
                      `• สต็อกพร้อมส่ง: ${p.stock_qty} ${sealType === 'O-Ring' ? 'วง' : 'ชิ้น'}\n` +
                      `• ราคา: ${unitPrice} บาท/${sealType === 'O-Ring' ? 'วง' : 'ชิ้น'}\n` +
                      `• ยอดรวม (${qty} ${sealType === 'O-Ring' ? 'วง' : 'ชิ้น'}): ${finalTotal} บาท${discText}\n` +
                      `• สถานะ: ${evalRes.notes}\n\n` +
                      `หากต้องการสั่งซื้อหรือเปิดใบเสนอราคา พิมพ์ "ยืนยันสั่งซื้อ" ได้เลยค่ะ 🙏`;

          await replyLineMessage(replyToken, reply);
        } else if (evalRes.status === 'needs_admin_approval') {
          // Notify customer to wait
          await replyLineMessage(replyToken, `ทางเราพบขนาดใกล้เคียงที่อาจใช้ทดแทนได้ค่ะ (${evalRes.notes})\nขณะนี้กำลังส่งให้วิศวกรและแอดมินตรวจสอบความเหมาะสมสักครู่ค่ะ 🙏`);
          
          // Send Telegram Alert to Admin with inline buttons
          await sendTelegramApprovalRequest(userId, specText, evalRes.product?.name, evalRes.notes);
        } else {
          await replyLineMessage(replyToken, `ขออภัยค่ะ ไม่พบสต็อกขนาด ${specText} ตรงรุ่นในระบบ\nทีมงานกำลังตรวจสอบสต็อกสาขาเพิ่มเติมให้สักครู่นะคะ 🙏`);
        }

        // Log chat
        await supabase.from('ai_chat_logs').insert({
          channel: 'line',
          sender_id: userId,
          message_text: userMsg,
          ai_response: evalRes.status
        });
      } catch (err) {
        console.error('LINE Webhook Error:', err);
      }
    }
  }
});

// ── 3. Telegram Webhook Endpoint (Admin Approval Workflow) ───────────
app.post('/webhook/telegram', async (req, res) => {
  res.status(200).send('OK');
  const update = req.body;

  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || ''; // e.g. "APPROVE:O-Ring:90x5.5:OR-089-057"
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;

    if (data.startsWith('APPROVE:')) {
      const parts = data.split(':');
      const sealType = parts[1];
      const reqSpec = parts[2];
      const subSku = parts[3];

      // Save to approved_substitutes in Supabase
      await supabase.from('approved_substitutes').insert({
        seal_type: sealType,
        requested_spec: reqSpec,
        substitute_sku: subSku,
        substitute_name: reqSpec,
        application_condition: 'Static Seal Only',
        approved_by: cb.from.first_name || 'Admin'
      });

      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        chat_id: chatId,
        message_id: msgId,
        text: `✅ อนุมัติคู่สินค้าทดแทนแล้ว:\n• สเปก: ${reqSpec}\n• SKU ที่ใช้แทน: ${subSku}\n• บันทึกเข้าฐานข้อมูล Sealthai AI เรียบร้อยแล้ว ✓`
      });
    } else if (data.startsWith('REJECT:')) {
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
        chat_id: chatId,
        message_id: msgId,
        text: `❌ ปฏิเสธการใช้สินค้าทดแทนรายการนี้เรียบร้อย`
      });
    }
  }
});

async function replyLineMessage(replyToken, text) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  await axios.post('https://api.line.me/v2/bot/message/reply', {
    replyToken,
    messages: [{ type: 'text', text }]
  }, {
    headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` }
  });
}

async function sendTelegramApprovalRequest(userId, reqSpec, subName, notes) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_ADMIN_CHAT_ID) return;
  const text = `🔍 <b>คำขออนุมัติสินค้าทดแทน (Sealthai AI)</b>\n\n` +
               `• ลูกค้าขอขนาด: <code>${reqSpec}</code>\n` +
               `• สินค้าเทียบที่พบ: <b>${subName}</b>\n` +
               `• หมายเหตุ: ${notes}\n` +
               `• ลักษณะงาน: Static Seal\n\n` +
               `กรุณาพิจารณาอนุมัติเพื่อให้บอทเสนอขายลูกค้าอัตโนมัติ:`;

  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_ADMIN_CHAT_ID,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ อนุมัติ (Static Seal)', callback_data: `APPROVE:O-Ring:${reqSpec}:${subName}` },
          { text: '❌ ไม่อนุมัติ', callback_data: `REJECT:O-Ring:${reqSpec}:${subName}` }
        ]
      ]
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Sealthai AI Bot Server is running on port ${PORT}`);
});
