#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════════════════
  Web人 — Automatic Invoice Generator
  Multi-language (EN / ID / ZH-TW) · n8n-ready · PDF output
═══════════════════════════════════════════════════════════════════════

USAGE (standalone):
    python3 invoice_generator.py                          # sample invoices
    echo '{ JSON }' | python3 invoice_generator.py        # from n8n / pipe

n8n "Execute Command" node:
    echo '{{ JSON.stringify($json) }}' | python3 /path/to/invoice_generator.py

JSON input schema:
{
  "language": "en",                     // "en" | "id" | "zh"
  "invoice_number": "INV-2026-001",
  "invoice_date": "2026-03-28",         // or omit for today
  "due_days": 30,                       // days until due (default 30)
  "client_name": "John Doe",
  "client_address": "123 Main St",
  "client_city": "Jakarta 10110",
  "client_email": "john@example.com",
  "items": [
    { "desc": "Web Design", "qty": 1, "price": 5000000 }
  ],
  "currency": "IDR",                    // "IDR" | "TWD" | "USD"
  "tax_rate": 0.11,                     // 0-1, e.g. 0.11 = 11%
  "discount": 0,
  "notes": "Optional note"
}
"""

import json
import sys
import os
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

# ─── Register CJK-capable fonts ──────────────────────────────────────────────
WQY_PATH = "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"
LIB_PATH = "/usr/share/fonts/truetype/liberation/"

_cjk_available = os.path.exists(WQY_PATH)
if _cjk_available:
    pdfmetrics.registerFont(TTFont("CJK",      WQY_PATH, subfontIndex=0))
    pdfmetrics.registerFont(TTFont("CJK-Bold",  WQY_PATH, subfontIndex=1))
if os.path.exists(LIB_PATH + "LiberationSans-Regular.ttf"):
    pdfmetrics.registerFont(TTFont("LibSans",      LIB_PATH + "LiberationSans-Regular.ttf"))
    pdfmetrics.registerFont(TTFont("LibSans-Bold",  LIB_PATH + "LiberationSans-Bold.ttf"))

FONT      = "CJK"      if _cjk_available else "Helvetica"
FONT_BOLD = "CJK-Bold"  if _cjk_available else "Helvetica-Bold"

# ─── Color Palette ────────────────────────────────────────────────────────────
PRIMARY    = HexColor("#1B2A4A")
ACCENT     = HexColor("#2980B9")
ACCENT_DK  = HexColor("#1F6FA3")
LIGHT_BG   = HexColor("#F2F6FA")
WHITE      = HexColor("#FFFFFF")
DARK       = HexColor("#1B2A4A")
MID        = HexColor("#7B8794")
BORDER     = HexColor("#D5DDE5")

# ─── Company Info (Web人) ─────────────────────────────────────────────────────
COMPANY = {
    "name":     "Web人",
    "address":  "介仁街67號",
    "city":     "花蓮市, 花蓮",
    "phone":    "+62 085174205811",
    "email":    "billing@webren.net",
    "website":  "webren.net",
}

BANK_ACCOUNTS = [
    {
        "country": {"en": "Indonesia", "id": "Indonesia", "zh": "印尼"},
        "bank":    "BCA",
        "name":    "Aaron Preston",
        "account": "6044392946",
    },
    {
        "country": {"en": "Taiwan", "id": "Taiwan", "zh": "台灣"},
        "bank":    "700 中華郵政股份有限公司",
        "name":    "李宜倖",
        "account": "00911870209677",
    },
]

# ─── Translations ─────────────────────────────────────────────────────────────
I18N = {
    "invoice":        {"en": "INVOICE",           "id": "TAGIHAN",           "zh": "發票"},
    "invoice_no":     {"en": "Invoice No.",        "id": "No. Invoice",       "zh": "發票編號"},
    "date":           {"en": "Date",               "id": "Tanggal",           "zh": "日期"},
    "due_date":       {"en": "Due Date",           "id": "Jatuh Tempo",       "zh": "到期日"},
    "from":           {"en": "FROM",               "id": "DARI",              "zh": "寄件人"},
    "bill_to":        {"en": "BILL TO",            "id": "TAGIH KE",          "zh": "帳單寄至"},
    "num":            {"en": "#",                   "id": "#",                 "zh": "#"},
    "description":    {"en": "Description",        "id": "Deskripsi",         "zh": "品項說明"},
    "qty":            {"en": "Qty",                "id": "Jml",               "zh": "數量"},
    "unit_price":     {"en": "Unit Price",         "id": "Harga Satuan",      "zh": "單價"},
    "amount":         {"en": "Amount",             "id": "Jumlah",            "zh": "金額"},
    "subtotal":       {"en": "Subtotal",           "id": "Subtotal",          "zh": "小計"},
    "discount":       {"en": "Discount",           "id": "Diskon",            "zh": "折扣"},
    "tax":            {"en": "Tax",                "id": "Pajak",             "zh": "稅金"},
    "total":          {"en": "TOTAL DUE",          "id": "TOTAL",             "zh": "應付總額"},
    "notes":          {"en": "Notes",              "id": "Catatan",           "zh": "備註"},
    "payment":        {"en": "Payment — Bank Transfer",
                       "id": "Pembayaran — Transfer Bank",
                       "zh": "付款方式 — 銀行轉帳"},
    "bank":           {"en": "Bank",               "id": "Bank",              "zh": "銀行"},
    "acc_name":       {"en": "Name",               "id": "Nama",              "zh": "戶名"},
    "acc_number":     {"en": "Acc. No.",           "id": "No. Rek.",          "zh": "帳號"},
    "country":        {"en": "Country",            "id": "Negara",            "zh": "國家"},
    "thank_you":      {"en": "Thank you for your business!",
                       "id": "Terima kasih atas kepercayaan Anda!",
                       "zh": "感謝您的惠顧！"},
    "payment_due_in": {"en": "Payment due within {days} days.",
                       "id": "Pembayaran dalam {days} hari.",
                       "zh": "請於 {days} 日內付款。"},
    "terms":          {"en": "Terms",              "id": "Ketentuan",         "zh": "條款"},
    "late_terms":     {"en": "All services will be paused if payment is not received within {days} days of the due date.",
                       "id": "Semua layanan akan dihentikan sementara apabila pembayaran tidak diterima dalam {days} hari setelah jatuh tempo.",
                       "zh": "若逾期 {days} 日仍未收到款項，所有服務將暫停提供。"},
    "paid":           {"en": "PAID",               "id": "LUNAS",             "zh": "已付清"},
    "paid_on":        {"en": "Paid on",            "id": "Dibayar pada",      "zh": "付款日期"},
    "status":         {"en": "Status",             "id": "Status",            "zh": "狀態"},
}


def t(key, lang="en", **kwargs):
    text = I18N.get(key, {}).get(lang, I18N.get(key, {}).get("en", key))
    if kwargs:
        text = text.format(**kwargs)
    return text


# ─── Currency ─────────────────────────────────────────────────────────────────
CURRENCY_SYM = {"USD": "$", "IDR": "Rp.", "TWD": "NT$", "EUR": "€", "GBP": "£"}

def fmt(amount, cur="USD"):
    s = CURRENCY_SYM.get(cur, cur + " ")
    return f"{s} {amount:,.0f}" if cur == "IDR" else f"{s}{amount:,.2f}"


# ─── Drawing Helpers ──────────────────────────────────────────────────────────
def rrect(c, x, y, w, h, r, fill=None, stroke=None):
    p = c.beginPath(); p.roundRect(x, y, w, h, r)
    if fill: c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke); c.setLineWidth(0.5)
    c.drawPath(p, fill=1 if fill else 0, stroke=1 if stroke else 0)

def txt(c, x, y, s, font=None, sz=9, col=DARK):
    c.setFont(font or FONT, sz); c.setFillColor(col); c.drawString(x, y, str(s))

def txtr(c, x, y, s, font=None, sz=9, col=DARK):
    c.setFont(font or FONT, sz); c.setFillColor(col); c.drawRightString(x, y, str(s))

def wrap(text, n):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 <= n:
            cur += (" " if cur else "") + w
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines


# ═════════════════════════════════════════════════════════════════════════════
#  MAIN GENERATOR
# ═════════════════════════════════════════════════════════════════════════════
def generate_invoice(
    output_path="invoice.pdf",
    language="en",
    invoice_number="INV-0001",
    invoice_date=None,
    due_days=30,
    client_name="",
    client_address="",
    client_city="",
    client_email="",
    items=None,
    currency="USD",
    tax_rate=0.0,
    discount=0.0,
    notes="",
    paid=False,
    paid_date=None,
):
    lang = language
    if invoice_date is None:
        invoice_date = datetime.now().strftime("%Y-%m-%d")
    try:
        dt = datetime.strptime(invoice_date, "%Y-%m-%d")
    except ValueError:
        dt = datetime.now()

    due_dt   = dt + timedelta(days=due_days)
    date_str = dt.strftime("%d %b %Y")
    due_str  = due_dt.strftime("%d %b %Y")
    items    = items or []

    W, H = letter
    c = canvas.Canvas(output_path, pagesize=letter)
    M = 0.55 * inch

    # ── HEADER BAR ────────────────────────────────────────────────────────
    c.setFillColor(PRIMARY)
    c.rect(0, H - 88, W, 88, fill=1, stroke=0)

    txt(c, M, H - 40, COMPANY["name"], font=FONT_BOLD, sz=24, col=WHITE)
    contact = f'{COMPANY["phone"]}  ·  {COMPANY["email"]}  ·  {COMPANY["website"]}'
    txt(c, M, H - 57, contact, sz=7.5, col=HexColor("#A0B4CC"))
    txtr(c, W - M, H - 48, t("invoice", lang), font=FONT_BOLD, sz=26, col=WHITE)

    # ── INVOICE META + FROM + BILL TO  (3-column row) ─────────────────────
    row_y = H - 110

    # Column 1: FROM
    txt(c, M, row_y, t("from", lang), font=FONT_BOLD, sz=8.5, col=ACCENT)
    from_lines_raw = [COMPANY["name"], COMPANY["address"], COMPANY["city"], COMPANY["email"]]
    from_lines = []
    for line in from_lines_raw:
        if line:
            from_lines.extend(wrap(line, 28))
    for i, line in enumerate(from_lines):
        txt(c, M, row_y - 15 - i * 13, line, sz=8.5)

    # Column 2: BILL TO
    bt_x = M + 180
    txt(c, bt_x, row_y, t("bill_to", lang), font=FONT_BOLD, sz=8.5, col=ACCENT)
    to_lines_raw = [client_name, client_address, client_city, client_email]
    # Wrap long lines to prevent overlap with invoice details box
    max_chars = 32
    to_lines = []
    for line in to_lines_raw:
        if line:
            to_lines.extend(wrap(line, max_chars))
    for i, line in enumerate(to_lines):
        txt(c, bt_x, row_y - 15 - i * 13, line, sz=8.5)

    # Column 3: Invoice details box (right side)
    box_w, box_h = 195, 72
    box_x = W - M - box_w
    box_y = row_y - box_h + 12

    rrect(c, box_x, box_y, box_w, box_h, 6, fill=LIGHT_BG, stroke=BORDER)

    lbl_x = box_x + 12
    val_x = box_x + box_w - 12
    ry = box_y + box_h - 19

    for label, value in [
        (t("invoice_no", lang), str(invoice_number)),
        (t("date", lang),       date_str),
        (t("due_date", lang),   due_str),
    ]:
        txt(c, lbl_x, ry, label, sz=8.5, col=MID)
        txtr(c, val_x, ry, value, font=FONT_BOLD, sz=8.5)
        ry -= 19

    # ── LINE ITEMS TABLE ──────────────────────────────────────────────────
    # Adjust table position based on how many address lines we have
    addr_lines_count = max(len(from_lines), len(to_lines), 4)
    table_top = row_y - 15 - addr_lines_count * 13 - 15

    header = [t("num", lang), t("description", lang), t("qty", lang),
              t("unit_price", lang), t("amount", lang)]
    rows = [header]

    subtotal = 0.0
    for idx, item in enumerate(items, 1):
        desc  = item.get("desc", item.get("description", ""))
        qty   = item.get("qty", item.get("quantity", 1))
        price = item.get("price", item.get("unit_price", 0))
        amt   = qty * price
        subtotal += amt
        rows.append([str(idx), desc, str(qty), fmt(price, currency), fmt(amt, currency)])

    col_w = [28, 228, 40, 100, 102]
    tbl = Table(rows, colWidths=col_w)

    ts = [
        ("BACKGROUND",    (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("FONTNAME",      (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE",      (0, 0), (-1, 0), 8.5),
        ("TOPPADDING",    (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("FONTNAME",      (0, 1), (-1, -1), FONT),
        ("FONTSIZE",      (0, 1), (-1, -1), 8.5),
        ("TOPPADDING",    (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("TEXTCOLOR",     (0, 1), (-1, -1), DARK),
        ("ALIGN",  (0, 0), (0, -1), "CENTER"),
        ("ALIGN",  (2, 0), (2, -1), "CENTER"),
        ("ALIGN",  (3, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 1, PRIMARY),
        ("LINEBELOW", (0, -1), (-1, -1), 1, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(rows)):
        if i % 2 == 0:
            ts.append(("BACKGROUND", (0, i), (-1, i), LIGHT_BG))
        ts.append(("LINEBELOW", (0, i), (-1, i), 0.4, BORDER))
    tbl.setStyle(TableStyle(ts))
    tw, th = tbl.wrap(0, 0)
    tbl.drawOn(c, M, table_top - th)

    # ── TOTALS ────────────────────────────────────────────────────────────
    ty = table_top - th - 18
    tot_w = 210
    tot_x = W - M - tot_w

    def trow(label, value, highlight=False):
        nonlocal ty
        if highlight:
            rrect(c, tot_x - 8, ty - 7, tot_w + 16, 24, 5, fill=ACCENT)
            txt(c, tot_x, ty, label, font=FONT_BOLD, sz=10, col=WHITE)
            txtr(c, tot_x + tot_w, ty, value, font=FONT_BOLD, sz=10, col=WHITE)
        else:
            txt(c, tot_x, ty, label, sz=9)
            txtr(c, tot_x + tot_w, ty, value, font=FONT_BOLD, sz=9)
        ty -= 22

    trow(t("subtotal", lang), fmt(subtotal, currency))
    if discount > 0:
        trow(t("discount", lang), f"- {fmt(discount, currency)}")
    tax_amt = (subtotal - discount) * tax_rate
    if tax_rate > 0:
        trow(f'{t("tax", lang)} ({tax_rate*100:.1f}%)', fmt(tax_amt, currency))
    grand = subtotal - discount + tax_amt
    ty -= 4
    trow(t("total", lang), fmt(grand, currency), highlight=True)

    # ── PAYMENT INFO CARD (skip if paid) ─────────────────────────────────
    if not paid:
        pay_top = ty - 16
        card_h  = 80
        card_y  = pay_top - card_h

        rrect(c, M, card_y, W - 2 * M, card_h, 6, fill=LIGHT_BG, stroke=BORDER)

        # Title
        txt(c, M + 14, pay_top - 16, t("payment", lang), font=FONT_BOLD, sz=9, col=ACCENT_DK)
        c.setStrokeColor(BORDER); c.setLineWidth(0.4)
        c.line(M + 14, pay_top - 22, W - M - 14, pay_top - 22)

        # Two-column bank details
        col_w_half = (W - 2 * M - 56) / 2
        for i, bank in enumerate(BANK_ACCOUNTS):
            bx = M + 14 + i * (col_w_half + 28)
            by = pay_top - 38

            country_name = bank["country"].get(lang, bank["country"]["en"])
            txt(c, bx, by, country_name, font=FONT_BOLD, sz=8.5, col=DARK)

            info = [
                (t("bank", lang),       bank["bank"]),
                (t("acc_name", lang),    bank["name"]),
                (t("acc_number", lang),  bank["account"]),
            ]
            for j, (lbl, val) in enumerate(info):
                txt(c, bx, by - 14 - j * 12, f"{lbl}:", sz=7.5, col=MID)
                txt(c, bx + 55, by - 14 - j * 12, val, sz=7.5)

        # Notes
        ny = card_y - 18
        if notes:
            txt(c, M, ny, t("notes", lang), font=FONT_BOLD, sz=8.5, col=ACCENT)
            note_lines = wrap(notes, 95)
            for i, line in enumerate(note_lines):
                txt(c, M, ny - 14 - i * 12, line, sz=8, col=MID)
            ny = ny - 14 - len(note_lines) * 12 - 6

        # Late payment terms
        terms_text = t("late_terms", lang, days=due_days)
        txt(c, M, ny, t("terms", lang), font=FONT_BOLD, sz=8.5, col=ACCENT)
        terms_lines = wrap(terms_text, 95)
        for i, line in enumerate(terms_lines):
            txt(c, M, ny - 14 - i * 12, line, sz=8, col=MID)

    else:
        # ── PAID: watermark + stamp box ───────────────────────────────────
        # Large diagonal watermark behind content
        c.saveState()
        c.translate(W / 2, H / 2)
        c.rotate(35)
        c.setFillColor(HexColor("#27AE60"))
        c.setFillAlpha(0.07)
        c.setFont(FONT_BOLD, 120)
        paid_label = t("paid", lang)
        c.drawCentredString(0, -30, paid_label)
        c.restoreState()

        # Stamp box (right-aligned, below totals)
        stamp_w, stamp_h = 216, 52
        stamp_x = W - M - stamp_w
        stamp_y = ty - 16

        c.saveState()
        c.setStrokeColor(HexColor("#27AE60"))
        c.setLineWidth(2.5)
        c.setDash(6, 3)
        c.setFillColor(HexColor("#27AE60"))
        c.setFillAlpha(0.05)
        p = c.beginPath()
        p.roundRect(stamp_x, stamp_y - stamp_h, stamp_w, stamp_h, 8)
        c.drawPath(p, fill=1, stroke=1)
        c.restoreState()

        # Paid label
        c.setFillColor(HexColor("#27AE60"))
        c.setFont(FONT_BOLD, 16)
        c.drawCentredString(stamp_x + stamp_w / 2, stamp_y - 24, paid_label)

        # Paid date
        if paid_date:
            try:
                pd = datetime.strptime(paid_date, "%Y-%m-%d")
                pd_str = pd.strftime("%d %b %Y")
            except ValueError:
                pd_str = paid_date
            c.setFont(FONT, 8.5)
            c.setFillColor(HexColor("#1E8449"))
            c.drawCentredString(stamp_x + stamp_w / 2, stamp_y - 42,
                                f'{t("paid_on", lang)}: {pd_str}')

    # ── FOOTER ────────────────────────────────────────────────────────────
    c.setFillColor(PRIMARY)
    c.rect(0, 0, W, 26, fill=1, stroke=0)
    footer_txt = f'{t("thank_you", lang)}  ·  {COMPANY["name"]}  ·  {COMPANY["website"]}'
    c.setFont(FONT, 7); c.setFillColor(HexColor("#A0B4CC"))
    c.drawCentredString(W / 2, 9, footer_txt)

    c.save()
    return output_path


# ═════════════════════════════════════════════════════════════════════════════
#  CLI / n8n ENTRY POINT
# ═════════════════════════════════════════════════════════════════════════════
def main():
    data = None

    # Read from stdin (piped JSON from n8n)
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"ERROR: Invalid JSON — {e}", file=sys.stderr)
                sys.exit(1)

    if data:
        lang     = data.get("language", "en")
        inv_num  = data.get("invoice_number", f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}")
        inv_date = data.get("invoice_date", None)
        due_days = data.get("due_days", 30)
        cur      = data.get("currency", "USD")
        tax      = data.get("tax_rate", 0.0)
        disc     = data.get("discount", 0.0)
        is_paid  = data.get("paid", False)
        paid_dt  = data.get("paid_date", None)
        nts      = data.get("notes", t("payment_due_in", lang, days=due_days))

        items = []
        for item in data.get("items", []):
            items.append({
                "desc":  item.get("desc", item.get("description", "")),
                "qty":   item.get("qty", item.get("quantity", 1)),
                "price": item.get("price", item.get("unit_price", 0)),
            })

        out_dir  = data.get("output_dir", ".")
        out_name = data.get("output_filename", f"{inv_num}.pdf")
        out_path = os.path.join(out_dir, out_name)

        result = generate_invoice(
            output_path=out_path,
            language=lang,
            invoice_number=inv_num,
            invoice_date=inv_date,
            due_days=due_days,
            client_name=data.get("client_name", ""),
            client_address=data.get("client_address", ""),
            client_city=data.get("client_city", ""),
            client_email=data.get("client_email", ""),
            items=items,
            currency=cur,
            tax_rate=tax,
            discount=disc,
            notes=nts,
            paid=is_paid,
            paid_date=paid_dt,
        )
        # Output path on stdout so n8n can capture it
        print(json.dumps({"status": "ok", "file": result, "total": sum(
            i["qty"] * i["price"] for i in items
        ) - disc + (sum(i["qty"] * i["price"] for i in items) - disc) * tax}))

    else:
        # ── Generate sample invoices (same content, language-swapped) ─────
        client = ("Sunrise Corp.", "456 Innovation Drive", "Austin, TX 73301", "billing@sunrise.com")
        base_items = [
            {"en": "Website Redesign — UX Research",     "id": "Desain Ulang Website — Riset UX",         "zh": "網站重新設計 — UX 研究"},
            {"en": "Frontend Development (React)",       "id": "Pengembangan Frontend (React)",            "zh": "前端開發 (React)"},
            {"en": "Backend API Integration",            "id": "Integrasi API Backend",                    "zh": "後端 API 串接整合"},
            {"en": "SEO Audit & Optimization",           "id": "Audit & Optimasi SEO",                    "zh": "SEO 優化與稽核"},
        ]
        qtys   = [1, 40, 20, 1]
        prices = [3500, 150, 175, 1200]

        for lang in ["en", "id", "zh"]:
            items = [{"desc": it[lang], "qty": q, "price": p}
                     for it, q, p in zip(base_items, qtys, prices)]
            path = f"/mnt/user-data/outputs/invoice_sample_{lang}.pdf"
            name, addr, city, email = client
            generate_invoice(
                output_path=path, language=lang, invoice_number="INV-2026-0042",
                items=items, currency="USD", tax_rate=0.0, discount=500,
                client_name=name, client_address=addr,
                client_city=city, client_email=email,
                notes=t("payment_due_in", lang, days=30),
            )
            print(f"  ✓ {lang.upper():>2} → {path}")


if __name__ == "__main__":
    main()
