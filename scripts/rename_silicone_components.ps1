param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'O-Ring Kits\SEALTHAI_Silicone_Component_Master_v2.csv'
$components = @(Import-Csv -LiteralPath $source -Encoding UTF8)
if ($components.Count -ne 60 -or @($components | Select-Object -ExpandProperty component_sku -Unique).Count -ne 60) {
  throw 'Component master ต้องมี 60 SKU ไม่ซ้ำ'
}
$config = @{}
Get-Content -LiteralPath (Join-Path $root '.env') | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $config[$Matches[1]] = $Matches[2] }
}
$apiBase = $config['SUPABASE_URL'].TrimEnd('/')
$apiKey = $config['SUPABASE_SERVICE_ROLE_KEY']
if (!$apiBase -or !$apiKey) { throw 'ไม่พบ Supabase config' }
$headers = @{ apikey = $apiKey; Authorization = "Bearer $apiKey"; Prefer = 'return=representation' }
$shopsRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/shops?select=id,name&name=eq.sealthai" -Headers $headers
$shops = @($shopsRaw | Where-Object { $_ -and $_.id })
if ($shops.Count -ne 1) { throw 'ไม่พบร้าน sealthai เพียงหนึ่งรายการ' }
$shopId = $shops[0].id
$raw = Invoke-RestMethod -Uri "$apiBase/rest/v1/products?select=id,sku,name,category,application_note,stock_qty,sell_price,purchase_price,current_cost&shop_id=eq.$shopId&sku=like.ST-ORS-W-*&limit=500" -Headers $headers
$products = @($raw | Where-Object { $_ -and $_.sku })
if ($products.Count -ne 66 -or @($products | Where-Object { $_.sku -like 'ST-ORS-W-KIT-*' }).Count -ne 6) {
  throw 'ต้องพบสินค้า 66 SKU (รายชิ้น 60 และชุด 6) ก่อนแก้ไข'
}
$bySku = @{}
foreach ($product in $products) {
  if ($bySku.ContainsKey($product.sku)) { throw "SKU ซ้ำในระบบ: $($product.sku)" }
  $bySku[$product.sku] = $product
}
$categoryName = 'O-Ring Silicone White Translucent'
$desired = @{}
foreach ($component in $components) {
  if (!$bySku.ContainsKey($component.component_sku)) { throw "ไม่มี SKU ในระบบ: $($component.component_sku)" }
  $id = ([decimal]$component.id_mm).ToString('0.################', [Globalization.CultureInfo]::InvariantCulture)
  $cs = ([decimal]$component.cs_mm).ToString('0.################', [Globalization.CultureInfo]::InvariantCulture)
  $desired[$component.component_sku] = "O-Ring Silicone White Translucent ${id}x${cs} mm (โอริงซิลิโคนสีขาว)"
}
$changes = @($components | Where-Object {
  $product = $bySku[$_.component_sku]
  $product.name -cne $desired[$_.component_sku] -or
  $product.category -cne $categoryName
})
$kitChanges = @()
$kitUpdates = @{}
foreach ($kit in @($products | Where-Object { $_.sku -like 'ST-ORS-W-KIT-*' })) {
  $match = [regex]::Match([string]$kit.application_note, '\[\[BOM64:([A-Za-z0-9+/=]+)\]\]')
  if (!$match.Success) { throw "ไม่พบ BOM ในชุด $($kit.sku)" }
  $bom = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($match.Groups[1].Value)) | ConvertFrom-Json
  $changed = $false
  foreach ($line in $bom.components) {
    if (!$desired.ContainsKey($line.sku)) { throw "BOM อ้างถึง SKU ที่ไม่มีใน master: $($line.sku)" }
    if ($line.name -cne $desired[$line.sku]) {
      $line.name = $desired[$line.sku]
      $changed = $true
    }
  }
  if ($changed) {
    $bomJson = $bom | ConvertTo-Json -Depth 8 -Compress
    $bom64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bomJson))
    $kitUpdates[$kit.sku] = $kit.application_note.Replace($match.Value, "[[BOM64:$bom64]]")
    $kitChanges += $kit.sku
  }
}
$categoriesRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/categories?select=id,name&shop_id=eq.$shopId&name=eq.$([uri]::EscapeDataString($categoryName))" -Headers $headers
$categories = @($categoriesRaw | Where-Object { $_ -and $_.id })
if ($categories.Count -gt 1) { throw 'หมวดหมู่ปลายทางซ้ำในระบบ' }
Write-Output "ตรวจพบสินค้ารายชิ้น $($components.Count) SKU; ต้องปรับ $($changes.Count) SKU; BOM ชุดที่ต้องปรับ $($kitChanges.Count); หมวดหมู่มีอยู่แล้ว $($categories.Count -eq 1)"
Write-Output "ตัวอย่าง: ST-ORS-W-012-1.5 => $($desired['ST-ORS-W-012-1.5'])"
if (!$Apply) { Write-Output 'Dry run: ยังไม่ได้แก้ไขฐานข้อมูล'; return }
if (!$categories.Count) {
  $body = @{ shop_id = $shopId; name = $categoryName; sort_order = 0 } | ConvertTo-Json -Compress
  $createdRaw = Invoke-RestMethod -Method Post -Uri "$apiBase/rest/v1/categories" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
  $created = @($createdRaw | Where-Object { $_ -and $_.id })
  if ($created.Count -ne 1) { throw 'สร้างหมวดหมู่ไม่สำเร็จ' }
  Write-Output 'สร้างหมวดหมู่ใหม่แล้ว'
}
foreach ($component in $changes) {
  $product = $bySku[$component.component_sku]
  $body = @{ name = $desired[$component.component_sku]; category = $categoryName } | ConvertTo-Json -Compress
  $uri = "$apiBase/rest/v1/products?id=eq.$($product.id)&shop_id=eq.$shopId"
  $updatedRaw = Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
  $updated = @($updatedRaw | Where-Object { $_ -and $_.sku })
  if ($updated.Count -ne 1 -or $updated[0].sku -ne $component.component_sku) { throw "อัปเดต SKU ไม่สำเร็จ: $($component.component_sku)" }
}
foreach ($sku in $kitChanges) {
  $product = $bySku[$sku]
  $body = @{ application_note = $kitUpdates[$sku] } | ConvertTo-Json -Compress
  $uri = "$apiBase/rest/v1/products?id=eq.$($product.id)&shop_id=eq.$shopId"
  $updatedRaw = Invoke-RestMethod -Method Patch -Uri $uri -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body))
  $updated = @($updatedRaw | Where-Object { $_ -and $_.sku })
  if ($updated.Count -ne 1 -or $updated[0].sku -ne $sku) { throw "อัปเดต BOM ไม่สำเร็จ: $sku" }
}
Write-Output "อัปเดตแล้ว: สินค้ารายชิ้น $($changes.Count) SKU, BOM $($kitChanges.Count) ชุด; ราคาและสต็อกไม่เปลี่ยน"
