import openpyxl
import requests
import json
import time
import sys

# 1. Load config
env = {}
env_path = r'D:\Nature Online\Nature online\Shop Dashboard\.env'
with open(env_path, 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

url = env.get('SUPABASE_URL', '').rstrip('/')
key = env.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

def check_factory_stock_column():
    r = requests.get(f'{url}/rest/v1/products?select=factory_stock&limit=1', headers=headers)
    return r.status_code == 200

# 2. Check if column exists
has_factory_stock = check_factory_stock_column()
if not has_factory_stock:
    print("WARNING: 'factory_stock' column does not exist yet in Supabase products table.")
    print("Please execute supabase_products_factory_stock_v365.sql in Supabase SQL Editor.")
else:
    print("SUCCESS: 'factory_stock' column detected in Supabase products table!")

# 3. Load DB existing products
print("Fetching existing products from Supabase...")
r = requests.get(f'{url}/rest/v1/products?select=id,sku,name,supplier_sku,part_no,brand,stock_qty,current_cost,application_note,internal_note&limit=2000', headers=headers)
if r.status_code != 200:
    print(f"Error fetching products: {r.status_code} {r.text}")
    sys.exit(1)

db_prods = r.json()
print(f"Found {len(db_prods)} existing products in DB.")
db_by_supp_sku = {p['supplier_sku']: p for p in db_prods if p.get('supplier_sku')}

# 4. Load Excel
print("Loading Excel file...")
excel_path = r'D:\Nature Online\Nature online\Shop Dashboard\Price Import\oil-seal-import.xlsx'
wb = openpyxl.load_workbook(excel_path, data_only=True)

# 4.1 Skip list
ws_check = wb['ต้องตรวจ']
check_codes = set()
for r_row in list(ws_check.iter_rows(values_only=True))[1:]:
    if r_row and r_row[0]:
        check_codes.add(str(r_row[0]).strip())
print(f"Total check_codes to SKIP: {len(check_codes)}")

# 4.2 Parse sheet 'import'
ws_imp = wb['import']
headers_excel = next(ws_imp.iter_rows(values_only=True))
h_map = {h: i for i, h in enumerate(headers_excel)}

def safe_float(v):
    if v is None or v == '': return None
    try: return float(v)
    except: return None

def safe_int(v):
    if v is None or v == '': return 0
    try: return int(round(float(v)))
    except: return 0

def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s else None

to_update = []
to_insert = []
skipped = []

shop_id = '90c6e123-c6ed-4499-88d9-28edb3768d72' # sealthai

for row in ws_imp.iter_rows(values_only=True):
    if not row or row[0] == 'item_code': continue
    
    item_code = safe_str(row[h_map['item_code']])
    if not item_code: continue
    
    if item_code in check_codes:
        skipped.append(item_code)
        continue
        
    excel_sku = safe_str(row[h_map['sku']])
    product_name = safe_str(row[h_map['product_name']]) or safe_str(row[h_map['product_name_th']])
    category = safe_str(row[h_map['category']])
    cost_thb = safe_float(row[h_map['cost_thb']]) or 0.0
    erp_cost = safe_float(row[h_map['erp_item_cost']]) or cost_thb
    price_online = safe_float(row[h_map['price_online']]) or 0.0
    factory_stock = safe_int(row[h_map['factory_stock']])
    part_no = safe_str(row[h_map['part_no']])
    brand = safe_str(row[h_map['brand']])
    id_size = safe_float(row[h_map['id_size']])
    od_size = safe_float(row[h_map['od_size']])
    thk = safe_float(row[h_map['thk']])
    unit = safe_str(row[h_map['unit']]) or 'mm'
    seal_type = safe_str(row[h_map['seal_type']])
    material = safe_str(row[h_map['material']])
    temp_min = safe_float(row[h_map['temp_min_c']])
    temp_max = safe_float(row[h_map['temp_max_c']])
    price_rule_note = safe_str(row[h_map['price_rule_note']])
    internal_note = safe_str(row[h_map['internal_note']])
    
    if item_code in db_by_supp_sku:
        existing_p = db_by_supp_sku[item_code]
        # Keep existing SKU and stock_qty!
        upd = {
            '_id': existing_p['id'],
            'name': product_name,
            'category': category,
            'sell_price': price_online,
            'purchase_price': cost_thb,
            'current_cost': existing_p['current_cost'] if (existing_p.get('current_cost') and existing_p['current_cost'] > 0) else erp_cost,
            'part_no': part_no or existing_p.get('part_no'),
            'brand': brand or existing_p.get('brand'),
            'inner_diameter': id_size,
            'outer_diameter': od_size,
            'width': thk,
            'unit_dim': unit,
            'material': material,
            'seal_type': seal_type,
            'temp_min': temp_min,
            'temp_max': temp_max,
            'application_note': price_rule_note or existing_p.get('application_note'),
            'internal_note': internal_note or existing_p.get('internal_note')
        }
        if has_factory_stock:
            upd['factory_stock'] = factory_stock
        to_update.append(upd)
    else:
        ins = {
            'shop_id': shop_id,
            'sku': excel_sku,
            'name': product_name,
            'category': category,
            'sell_price': price_online,
            'purchase_price': cost_thb,
            'current_cost': erp_cost,
            'stock_qty': 0, # New items start with 0 shop stock
            'supplier_sku': item_code,
            'part_no': part_no,
            'brand': brand,
            'inner_diameter': id_size,
            'outer_diameter': od_size,
            'width': thk,
            'unit_dim': unit,
            'material': material,
            'seal_type': seal_type,
            'temp_min': temp_min,
            'temp_max': temp_max,
            'application_note': price_rule_note,
            'internal_note': internal_note,
            'active': True
        }
        if has_factory_stock:
            ins['factory_stock'] = factory_stock
        to_insert.append(ins)

print(f"\nPrepared: To Update = {len(to_update)}, To Insert = {len(to_insert)}, Skipped = {len(skipped)}")

# 5. Execution function
def execute_import():
    if not has_factory_stock:
        print("\nCANNOT EXECUTE: Please run the SQL migration in Supabase SQL Editor first!")
        return False
        
    print(f"\n--- STEP 1: UPDATING {len(to_update)} EXISTING PRODUCTS ---")
    upd_success = 0
    upd_failed = 0
    for idx, item in enumerate(to_update, 1):
        pid = item.pop('_id')
        r_upd = requests.patch(f'{url}/rest/v1/products?id=eq.{pid}', headers=headers, json=item)
        if r_upd.status_code in (200, 204):
            upd_success += 1
        else:
            upd_failed += 1
            print(f"Failed update for {item.get('name')}: {r_upd.status_code} {r_upd.text}")
        if idx % 50 == 0 or idx == len(to_update):
            print(f"  [Update Progress] {idx}/{len(to_update)} done (Success: {upd_success}, Fail: {upd_failed})")
            
    print(f"\n--- STEP 2: INSERTING {len(to_insert)} NEW PRODUCTS IN BATCHES ---")
    batch_size = 200
    ins_success = 0
    ins_failed = 0
    post_headers = {**headers, 'Prefer': 'return=minimal'}
    
    for i in range(0, len(to_insert), batch_size):
        batch = to_insert[i:i+batch_size]
        r_ins = requests.post(f'{url}/rest/v1/products', headers=post_headers, json=batch)
        if r_ins.status_code in (200, 201, 204):
            ins_success += len(batch)
        else:
            ins_failed += len(batch)
            print(f"Batch {i//batch_size + 1} failed: {r_ins.status_code} {r_ins.text}")
            # Try single items in this batch to identify exact error
            for single_item in batch:
                r_s = requests.post(f'{url}/rest/v1/products', headers=post_headers, json=[single_item])
                if r_s.status_code in (200, 201, 204):
                    ins_success += 1
                    ins_failed -= 1
                else:
                    print(f"  Single insert error for SKU {single_item.get('sku')}: {r_s.status_code} {r_s.text}")
        
        curr_total = min(i + batch_size, len(to_insert))
        print(f"  [Insert Progress] {curr_total}/{len(to_insert)} done (Success: {ins_success}, Fail: {ins_failed})")
        time.sleep(0.1) # brief pause to avoid network congestion
        
    print("\n=== IMPORT COMPLETED ===")
    print(f"Existing updated: {upd_success} (Failed: {upd_failed})")
    print(f"New inserted: {ins_success} (Failed: {ins_failed})")
    print(f"Skipped items: {len(skipped)}")
    return True

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--apply':
        execute_import()
    else:
        print("\nDry-run complete. Run with '--apply' to execute.")
