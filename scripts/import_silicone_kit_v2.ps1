param(
  [switch]$Apply,
  [ValidateSet('included', 'excluded', 'no_vat')]
  [string]$VatMode = 'no_vat'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $projectRoot 'O-Ring Kits'
$componentRows = @(Import-Csv -Encoding UTF8 -LiteralPath (Join-Path $sourceDir 'SEALTHAI_Silicone_Component_Master_v2.csv'))
$bomRows = @(Import-Csv -Encoding UTF8 -LiteralPath (Join-Path $sourceDir 'SEALTHAI_Silicone_Kit_BOM_Detail_v2.csv'))
$kitRows = @(Import-Csv -Encoding UTF8 -LiteralPath (Join-Path $sourceDir 'SEALTHAI_Silicone_Kit_Master_v2.csv'))

if ($componentRows.Count -ne 60 -or $kitRows.Count -ne 6 -or $bomRows.Count -ne 84) {
  throw 'จำนวนแถวในไฟล์ต้นทางไม่ตรงกับ Silicone Kit v2 (60 / 6 / 84)'
}
$componentSkus = @($componentRows | ForEach-Object component_sku)
$kitSkus = @($kitRows | ForEach-Object kit_sku)
if (@($componentSkus | Select-Object -Unique).Count -ne 60 -or @($kitSkus | Select-Object -Unique).Count -ne 6) {
  throw 'พบ SKU ซ้ำในไฟล์ master'
}
foreach ($kit in $kitRows) {
  $lines = @($bomRows | Where-Object kit_sku -eq $kit.kit_sku)
  $pieces = ($lines | Measure-Object qty_per_kit -Sum).Sum
  if ($lines.Count -ne [int]$kit.unique_skus -or $pieces -ne [int]$kit.total_pcs) {
    throw "จำนวน SKU หรือชิ้นต่อกล่องไม่ตรง: $($kit.kit_sku)"
  }
  if (@($lines | Where-Object { $_.component_sku -notin $componentSkus }).Count) {
    throw "BOM อ้างถึงโอริงที่ไม่มีใน master: $($kit.kit_sku)"
  }
  $allocated = ($lines | Measure-Object allocated_line_cost_thb -Sum).Sum
  if ([math]::Abs($allocated - [decimal]$kit.kit_cost_thb) -gt 0.01) {
    throw "ต้นทุน BOM ไม่ตรงกับ master: $($kit.kit_sku)"
  }
}
$confirmed24 = @($bomRows | Where-Object {
  $_.kit_sku -eq 'ST-ORS-W-KIT-2.4' -and $_.component_sku -eq 'ST-ORS-W-015-2.4'
})
if ($confirmed24.Count -ne 1 -or [int]$confirmed24[0].qty_per_kit -ne 40) {
  throw 'ชุด CS 2.4 ต้องมี 15×2.4 จำนวน 40 ตัวตามที่ยืนยัน'
}

$config = @{}
Get-Content -LiteralPath (Join-Path $projectRoot '.env') | ForEach-Object {
  if ($_ -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { $config[$Matches[1]] = $Matches[2] }
}
$apiBase = $config['SUPABASE_URL'].TrimEnd('/')
$apiKey = $config['SUPABASE_SERVICE_ROLE_KEY']
if (!$apiBase -or !$apiKey) { throw 'ไม่พบ Supabase URL หรือ service key ใน .env' }
$headers = @{ apikey = $apiKey; Authorization = "Bearer $apiKey"; Prefer = 'return=representation' }
$shopsRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/shops?select=id,name&name=eq.sealthai" -Headers $headers
$shops = @($shopsRaw | Where-Object { $_ -and $_.id })
if ($shops.Count -ne 1) { throw 'ต้องพบร้าน sealthai เพียงหนึ่งรายการ' }
$shopId = $shops[0].id
$existingRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/products?select=sku,name&shop_id=eq.$shopId&sku=like.ST-ORS-W-*&limit=500" -Headers $headers
$existing = @($existingRaw | Where-Object { $_ -and $_.sku })
$existingBySku = @{}
foreach ($product in $existing) { $existingBySku[$product.sku] = $product.name }

$payload = @()
foreach ($component in $componentRows) {
  if ($existingBySku.ContainsKey($component.component_sku)) { continue }
  $cost = [decimal]$component.weighted_avg_unit_cost_thb
  $payload += @{
    shop_id = $shopId
    sku = $component.component_sku
    name = $component.component_name
    category = 'O-Ring'
    sell_price = [decimal]$component.sale_price_rounded_thb
    purchase_price = $cost
    current_cost = 0
    stock_qty = 0
    active = $true
    inner_diameter = [decimal]$component.id_mm
    outer_diameter = [decimal]$component.od_mm
    width = [decimal]$component.cs_mm
    unit_dim = 'mm'
    material = 'Silicone'
    seal_type = 'O-Ring'
    pack_size = 1
    application_note = "ต้นทุนต่อชิ้นเป็นค่าเฉลี่ยที่ปันส่วนจากชุดในไฟล์ v2 ไม่ใช่ราคาซื้อแยกชิ้น`n[BUY_VAT:$VatMode]"
  }
}
foreach ($kit in $kitRows) {
  if ($existingBySku.ContainsKey($kit.kit_sku)) { continue }
  $lines = @($bomRows | Where-Object kit_sku -eq $kit.kit_sku)
  $bom = @{
    version = 1
    source = 'SEALTHAI Silicone Kit BOM v2'
    stock_mode = 'purchased_box'
    reference_kit_cost = [decimal]$kit.kit_cost_thb
    confirmed_duplicate = ($kit.kit_sku -eq 'ST-ORS-W-KIT-2.4')
    components = @($lines | ForEach-Object {
      @{
        sku = $_.component_sku
        name = $_.component_name
        qty = [int]$_.qty_per_kit
        reference_unit_price = [decimal]$_.unit_sale_price_rounded_thb
        allocated_unit_cost = [decimal]$_.allocated_unit_cost_thb
      }
    })
  }
  $bomJson = $bom | ConvertTo-Json -Depth 8 -Compress
  $bom64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($bomJson))
  $payload += @{
    shop_id = $shopId
    sku = $kit.kit_sku
    name = $kit.kit_name
    category = 'O-Ring Kit'
    sell_price = [decimal]$kit.box_sale_price_rounded_thb
    purchase_price = [decimal]$kit.kit_cost_thb
    current_cost = 0
    stock_qty = 0
    active = $true
    material = 'Silicone'
    seal_type = 'O-Ring Kit'
    unit_dim = 'mm'
    inner_diameter = $null
    outer_diameter = $null
    width = $null
    pack_size = 1
    application_note = "ชุดโอริงซิลิโคนสีขาวใส $($kit.total_pcs) ตัว/กล่อง $($kit.unique_skus) ขนาด รับซื้อเป็นกล่องสำเร็จจากผู้ขาย`n[BUY_VAT:$VatMode]`n[[BOM64:$bom64]]"
  }
}

Write-Output "ตรวจผ่าน: โอริง 60 SKU, ชุด 6 SKU, BOM 84 รายการ, 1,235 ตัว"
Write-Output "มีอยู่แล้ว: $($existing.Count) SKU; เตรียมเพิ่ม: $($payload.Count) SKU; VAT mode: $VatMode"
if (!$Apply) { Write-Output 'Dry run: ยังไม่ได้เขียนฐานข้อมูล'; return }
if (!$payload.Count) { Write-Output 'ไม่มีสินค้าใหม่ที่ต้องเพิ่ม'; return }
foreach ($batchStart in 0..([math]::Ceiling($payload.Count / 40) - 1)) {
  $batch = @($payload | Select-Object -Skip ($batchStart * 40) -First 40)
  $json = ConvertTo-Json -InputObject $batch -Depth 8 -Compress
  $null = Invoke-RestMethod -Method Post -Uri "$apiBase/rest/v1/products" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
  $batchSkus = @($batch | ForEach-Object sku)
  $batchCheckRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/products?select=sku&shop_id=eq.$shopId&sku=like.ST-ORS-W-*&limit=500" -Headers $headers
  $batchCheck = @($batchCheckRaw | Where-Object { $_ -and $_.sku })
  if (@($batchSkus | Where-Object { $_ -notin @($batchCheck | ForEach-Object sku) }).Count) {
    throw "ตรวจการเพิ่มสินค้าไม่ครบในชุด $($batchStart + 1)"
  }
  Write-Output "เพิ่มสินค้าแล้ว $($batch.Count) SKU"
}
$afterRaw = Invoke-RestMethod -Uri "$apiBase/rest/v1/products?select=sku,name,stock_qty&shop_id=eq.$shopId&sku=like.ST-ORS-W-*&limit=500" -Headers $headers
$after = @($afterRaw | Where-Object { $_ -and $_.sku })
if ($after.Count -ne 66 -or @($after | Where-Object { [decimal]$_.stock_qty -ne 0 }).Count) {
  throw 'ตรวจหลังนำเข้าไม่ผ่าน: จำนวน SKU หรือสต็อกเริ่มต้นผิด'
}
Write-Output 'นำเข้าสำเร็จ: 66 SKU; สต็อกเริ่มต้น 0 ทุก SKU'
