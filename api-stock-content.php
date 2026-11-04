<?php
declare(strict_types=1);

// Deploy this file to the sealthai.com document root. Configure the token in the
// web server environment; never place it in this file or a browser-side script.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(405, ['success' => false, 'error' => 'POST required']);
$expected = (string)(getenv('STOCK_CONTENT_PUBLISH_TOKEN') ?: '');
$provided = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if ($expected === '' || !hash_equals('Bearer ' . $expected, $provided)) {
    respond(401, ['success' => false, 'error' => 'Unauthorized']);
}
if (strlen((string)($_SERVER['CONTENT_LENGTH'] ?? '0')) > 100000) {
    respond(413, ['success' => false, 'error' => 'Request too large']);
}
$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) respond(400, ['success' => false, 'error' => 'Invalid JSON']);

$sku = trim((string)($body['sku'] ?? ''));
$slug = trim((string)($body['slug'] ?? ''));
$title = trim((string)($body['title'] ?? ''));
$excerpt = trim((string)($body['excerpt'] ?? ''));
$content = trim((string)($body['content'] ?? ''));
$imageUrl = trim((string)($body['imageUrl'] ?? ''));
$indexable = ($body['indexable'] ?? false) === true;
if ($sku === '' || strlen($sku) > 180 || !preg_match('/^stock-[a-z0-9-]{1,60}-[a-f0-9]{10}$/', $slug)
    || $title === '' || strlen($title) > 600 || strlen($excerpt) > 600
    || $content === '' || strlen($content) > 70000
    || preg_match('/<(script|iframe|object|embed|form|style)\b|\bon[a-z]+\s*=|javascript:/i', $content)) {
    respond(400, ['success' => false, 'error' => 'Invalid article data']);
}
if ($imageUrl !== '' && (!filter_var($imageUrl, FILTER_VALIDATE_URL) || parse_url($imageUrl, PHP_URL_SCHEME) !== 'https')) {
    $imageUrl = '';
}

$baseUrl = rtrim((string)(getenv('STOCK_CONTENT_PUBLIC_BASE_URL') ?: 'https://www.sealthai.com'), '/');
if (!in_array($baseUrl, ['https://www.sealthai.com', 'https://sealthai.com'], true)) {
    respond(500, ['success' => false, 'error' => 'Invalid public base URL configuration']);
}
$dir = __DIR__ . DIRECTORY_SEPARATOR . 'article' . DIRECTORY_SEPARATOR . 'stock';
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    respond(500, ['success' => false, 'error' => 'Article directory is not writable']);
}
$lock = fopen($dir . DIRECTORY_SEPARATOR . '.publisher.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX)) respond(500, ['success' => false, 'error' => 'Cannot lock article directory']);

try {
    $url = $baseUrl . '/article/stock/' . $slug . '.html';
    $date = date('c');
    $page = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . h($title) . '</title><meta name="description" content="' . h($excerpt) . '">'
        . ($indexable ? '' : '<meta name="robots" content="noindex,follow">')
        . '<link rel="canonical" href="' . h($url) . '"><meta property="og:type" content="article">'
        . '<meta property="og:title" content="' . h($title) . '"><meta property="og:description" content="' . h($excerpt) . '">'
        . '<meta property="og:url" content="' . h($url) . '">'
        . ($imageUrl !== '' ? '<meta property="og:image" content="' . h($imageUrl) . '">' : '')
        . '<style>body{margin:0;background:#f8fafc}nav{padding:16px max(20px,calc((100vw - 820px)/2));background:#0f172a;font:600 14px Arial,sans-serif}nav a{color:#fff;text-decoration:none;margin-right:18px}main{padding:24px 16px 48px}footer{text-align:center;padding:24px;font:13px Arial,sans-serif;color:#64748b}</style>'
        . '</head><body><nav><a href="/">SEALTHAI</a><a href="/article/">บทความ</a><a href="/article/stock/">สินค้าในสต๊อก</a></nav><main>'
        . $content . '</main><footer>SEALTHAI · ตรวจสอบสต๊อกและราคาล่าสุดก่อนสั่งซื้อ</footer></body></html>';
    $path = $dir . DIRECTORY_SEPARATOR . $slug . '.html';
    $tmp = tempnam($dir, 'page-');
    if ($tmp === false || file_put_contents($tmp, $page, LOCK_EX) === false || !rename($tmp, $path)) {
        if ($tmp && is_file($tmp)) unlink($tmp);
        throw new RuntimeException('Unable to write article');
    }
    $indexPath = $dir . DIRECTORY_SEPARATOR . 'index.json';
    $entries = is_file($indexPath) ? json_decode((string)file_get_contents($indexPath), true) : [];
    if (!is_array($entries)) $entries = [];
    $entries[$slug] = ['sku' => $sku, 'title' => $title, 'url' => $url, 'updated_at' => $date];
    uasort($entries, static fn($a, $b) => strcmp((string)$b['updated_at'], (string)$a['updated_at']));
    $indexJson = json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($indexJson === false || file_put_contents($indexPath, $indexJson, LOCK_EX) === false) {
        throw new RuntimeException('Unable to update article index');
    }
    $cards = '';
    foreach ($entries as $entry) {
        $cards .= '<li><a href="' . h((string)$entry['url']) . '">' . h((string)$entry['title']) . '</a>'
            . '<small>SKU ' . h((string)$entry['sku']) . ' · อัปเดต ' . h(substr((string)$entry['updated_at'], 0, 10)) . '</small></li>';
    }
    $indexPage = '<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>สินค้าในสต๊อก | SEALTHAI</title><meta name="description" content="รวมข้อมูลสินค้าในสต๊อกของ SEALTHAI พร้อมรหัส SKU และแนวทางตรวจสอบก่อนสั่งซื้อ">'
        . '<style>body{max-width:920px;margin:auto;padding:24px;font:16px/1.7 Arial,sans-serif;color:#172033}a{color:#0f766e}li{padding:14px;border-bottom:1px solid #ddd}small{display:block;color:#64748b}</style></head>'
        . '<body><a href="/article/">← บทความ SEALTHAI</a><h1>สินค้าในสต๊อก SEALTHAI</h1><p>จำนวนและราคาอาจเปลี่ยนแปลง กรุณายืนยันก่อนสั่งซื้อ</p><ul>'
        . $cards . '</ul></body></html>';
    if (file_put_contents($dir . DIRECTORY_SEPARATOR . 'index.html', $indexPage, LOCK_EX) === false) {
        throw new RuntimeException('Unable to update article listing');
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    respond(200, ['success' => true, 'url' => $url, 'updated_at' => $date]);
} catch (Throwable $error) {
    flock($lock, LOCK_UN);
    fclose($lock);
    error_log('[Stock Content Publisher] ' . $error->getMessage());
    respond(500, ['success' => false, 'error' => 'Publish failed']);
}
