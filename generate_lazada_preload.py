"""Build a private Lazada import payload from seller exports.

The source spreadsheets and output stay outside GitHub. Run this script again
when the exported order and income files are updated, then upload with a
service-role credential after the database migration is installed.
"""

import json
import os
from datetime import datetime
from pathlib import Path

from openpyxl import load_workbook


SOURCE = Path(os.environ.get("LAZADA_EXPORT_ROOT") or
              (Path(__file__).resolve().parents[2] / "Lazada" / "Lazada Order Summary"))
OUTPUT = Path(__file__).with_name("lazada_private_import.json")
MONTHS = ("2026-06", "2026-07", "2026-08", "2026-09", "2026-10")


def rows(path):
    sheet = load_workbook(path, read_only=False, data_only=True).active
    return list(sheet.values)[1:]


def amount(value):
    try:
        return round(float(str(value).replace(",", "")), 2)
    except (TypeError, ValueError):
        return 0.0


def iso_date(value):
    if not value:
        return ""
    text = str(value).strip()
    for pattern in ("%d %b %Y %H:%M", "%d %b %Y"):
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return text[:10]


items = {}
for month in MONTHS:
    for row in rows(SOURCE / "Order" / f"Order-{month}.xlsx"):
        item_id = str(row[0] or "").strip()
        order_id = str(row[12] or "").strip()
        if not item_id or not order_id:
            continue
        if item_id in items:
            raise ValueError(f"Duplicate Lazada orderItemId: {item_id}")
        items[item_id] = {
            "orderItemId": item_id,
            "orderId": order_id,
            "orderDate": iso_date(row[8]),
            "deliveredDate": iso_date(row[15]),
            "sellerSku": str(row[5] or "").strip(),
            "lazadaSku": str(row[6] or "").strip(),
            "name": str(row[52] or "").strip(),
            "variation": str(row[53] or "").strip(),
            "status": str(row[66] or "").strip(),
            "unitPrice": amount(row[47]),
            "paidPrice": amount(row[46]),
            "sellerDiscount": amount(row[48]),
            "platformDiscount": amount(row[49]),
            "shippingFee": amount(row[50]),
            "hasOrder": True,
            "transactions": [],
        }

for month in MONTHS:
    for row in rows(SOURCE / "2026-06" / f"{month}.xlsx"):
        item_id = str(row[11] or "").strip()
        order_id = str(row[10] or "").strip()
        if not item_id or not order_id:
            continue
        if item_id not in items:
            items[item_id] = {
                "orderItemId": item_id,
                "orderId": order_id,
                "orderDate": iso_date(row[9]),
                "sellerSku": str(row[12] or "").strip(),
                "lazadaSku": str(row[13] or "").strip(),
                "name": str(row[17] or "").strip(),
                "variation": "",
                "status": str(row[16] or "").strip(),
                "unitPrice": 0.0,
                "paidPrice": 0.0,
                "sellerDiscount": 0.0,
                "platformDiscount": 0.0,
                "shippingFee": 0.0,
                "hasOrder": False,
                "transactions": [],
            }
        item = items[item_id]
        if item["orderId"] != order_id:
            raise ValueError(f"Conflicting Lazada order for item {item_id}")
        item["transactions"].append({
            "date": iso_date(row[2]),
            "type": str(row[3] or "").strip(),
            "amount": amount(row[4]),
            "vat": amount(row[5]),
            "wht": amount(row[14]),
            "statement": str(row[1] or "").strip(),
        })

for item in items.values():
    item["transactions"].sort(key=lambda tx: (tx["date"], tx["statement"], tx["type"], tx["amount"]))

payload = sorted(items.values(), key=lambda item: (item["orderDate"], item["orderId"], item["orderItemId"]))
OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(json.dumps({"items": len(payload), "orders": len({item["orderId"] for item in payload}), "transactions": sum(len(item["transactions"]) for item in payload), "bytes": OUTPUT.stat().st_size}))
