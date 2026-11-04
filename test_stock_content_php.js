const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const { slugForSku } = require('./stock_content_autopublisher');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function waitForServer(url) {
  for (let i = 0; i < 40; i++) {
    try { await fetch(url); return; } catch (_) { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('PHP test server did not start');
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sealthai-stock-test-'));
  const phpFile = path.join(tmp, 'api-stock-content.php');
  fs.copyFileSync(path.join(__dirname, 'api-stock-content.php'), phpFile);
  const port = await freePort();
  const endpoint = `http://127.0.0.1:${port}/api-stock-content.php`;
  const token = 'test-token-do-not-use-in-production';
  const child = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', tmp], {
    env: { ...process.env, STOCK_CONTENT_PUBLISH_TOKEN: token },
    stdio: 'ignore',
    windowsHide: true
  });
  try {
    await waitForServer(endpoint);
    const sku = 'OS-NB-0108';
    const slug = slugForSku(sku);
    const body = { sku, slug, title: 'Test Product | SEALTHAI', excerpt: 'Test product description',
      content: '<article><h1>First version</h1></article>', imageUrl: '', indexable: true };
    const denied = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.strictEqual(denied.status, 401);
    const publish = async payload => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      assert.strictEqual(response.status, 200, JSON.stringify(result));
      return result;
    };
    const first = await publish(body);
    assert.strictEqual(first.success, true);
    assert(first.url.endsWith('/' + slug + '.html'));
    assert(fs.readFileSync(path.join(tmp, 'article', 'stock', slug + '.html'), 'utf8').includes('First version'));
    const second = await publish({ ...body, content: '<article><h1>Second version</h1></article>', indexable: false });
    assert.strictEqual(second.url, first.url, 'New cycles must update the same URL');
    const html = fs.readFileSync(path.join(tmp, 'article', 'stock', slug + '.html'), 'utf8');
    assert(html.includes('Second version'));
    assert(html.includes('noindex,follow'));
    assert(fs.existsSync(path.join(tmp, 'article', 'stock', 'index.html')));
    console.log('stock content PHP publisher tests passed');
  } finally {
    child.kill();
    if (tmp.startsWith(os.tmpdir() + path.sep)) fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
