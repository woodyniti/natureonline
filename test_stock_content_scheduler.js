const assert = require('assert');
const { startStockContentScheduler } = require('./stock_content_autopublisher');

const product = { id: 'p1', shop_id: 'shop1', sku: 'OR-01', name: 'O-RING NBR 12x2 mm', stock_qty: 5, active: true };
const rows = [];
const db = {
  run(sql, params, callback) {
    if (sql.includes('INSERT INTO stock_content_publications')) {
      rows.splice(0, rows.length, {
        product_id: params[0], sku: params[1], cycle: params[2], url: params[3],
        published_at: params[4], facebook: params[5], title: params[6]
      });
    }
    callback.call({}, null);
  },
  all(sql, _params, callback) {
    if (sql.includes('MAX(published_at)')) {
      callback(null, [{ published_at: rows[0]?.published_at || null }]);
    } else {
      callback(null, [...rows]);
    }
  }
};
const supabase = {
  from(name) {
    assert.strictEqual(name, 'products');
    const query = {
      select() { return this; },
      gt() { return this; },
      order() { return this; },
      range() { return this; },
      eq() { return this; },
      single: async () => ({ data: { stock_qty: product.stock_qty }, error: null }),
      then(resolve) { return Promise.resolve({ data: [product], error: null }).then(resolve); }
    };
    return query;
  }
};
let publishCount = 0;
let notifyCount = 0;
const axios = {
  async post(_url, body) {
    publishCount++;
    return { data: { success: true, url: `https://www.sealthai.com/article/stock/${body.slug}.html` } };
  }
};
const env = {
  STOCK_CONTENT_ENABLED: 'true',
  STOCK_CONTENT_PUBLISH_URL: 'https://www.sealthai.com/api-stock-content.php',
  STOCK_CONTENT_PUBLISH_TOKEN: 'test-token',
  TELEGRAM_ADMIN_CHAT_ID: '123',
  TELEGRAM_BOT_TOKEN: 'test-bot',
  DEFAULT_SHOP_ID: 'shop1',
  SUPABASE_SERVICE_ROLE_KEY: 'test-role'
};
(async () => {
  const controller = startStockContentScheduler({
    supabase, db, axios, env,
    sendTelegramMessage: async (_chat, msg) => {
      notifyCount++;
      assert(msg.includes('https://www.sealthai.com/article/stock/'));
    }
  });
  try {
    await controller.firstRun;
    assert.strictEqual(publishCount, 1);
    assert.strictEqual(notifyCount, 1);
    assert.strictEqual(rows[0].cycle, 0);
    await controller.tick();
    assert.strictEqual(publishCount, 1, 'Must not publish twice within an hour');
  } finally {
    controller.stop();
  }
  console.log('stock content scheduler tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
