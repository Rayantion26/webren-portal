# Invoice System Design — 2026-03-30

## Overview
Automate invoice creation and delivery for WebRen portal clients. When a client is added, a pending invoice is created. When Aaron marks a client as Completed, the invoice is emailed via n8n. When marked Paid, a receipt is sent.

## Status Flow

```
On Hold → Completed → Paid → Active (optional ongoing monthly)
```

| Status | Trigger | Invoice Action |
|--------|---------|----------------|
| On Hold | Agent adds new client | Invoice auto-created as `pending` |
| Completed | Admin sets status | Invoice marked `sent`, n8n webhook fires (invoice email to client) |
| Paid | Admin sets status | Invoice marked `paid`, n8n webhook fires (receipt email to client) |
| Active | Admin sets manually | No invoice action |

## Database Changes

### `invoices` table — add columns
- `commission_amount numeric` — agent's 15% cut (stored at invoice creation time)
- `sent_at timestamptz` — when invoice was emailed to client

### No schema changes needed for `clients` — statuses are free-text.

## Portal Changes (app.js + index.html)

### 1. Auto-create invoice on new client
In `handleAddClient()`, after the client insert succeeds, immediately insert an invoice:
- `amount` = `monthly_fee`
- `commission_amount` = `monthly_fee * 0.15`
- `due_date` = today + 7 days
- `status` = `pending`

### 2. Admin status dropdown
Admin sees two extra options: **Completed** and **Paid** (agents do not see these).

### 3. Status change side effects (in `updateClientStatus`)
- `completed` → update linked invoice: `status = 'sent'`, `sent_at = now()` → fire n8n invoice webhook
- `paid` → update linked invoice: `status = 'paid'`, `paid_at = now()` → fire n8n receipt webhook

### 4. n8n webhook payloads
Both POST requests send JSON to their respective webhook URLs:

**Invoice webhook (Completed):**
```json
{
  "event": "invoice_send",
  "client_name": "...",
  "client_email": "...",
  "amount": 4500,
  "due_date": "2026-04-06",
  "agent_name": "...",
  "invoice_id": "..."
}
```

**Receipt webhook (Paid):**
```json
{
  "event": "receipt_send",
  "client_name": "...",
  "client_email": "...",
  "amount": 4500,
  "paid_at": "2026-03-30T...",
  "agent_name": "...",
  "invoice_id": "..."
}
```

Webhook URLs stored as constants at the top of `app.js` — placeholders until Aaron provides real URLs.

### 5. Invoice section
- Admin sees **all** invoices (pending, sent, paid)
- Agents see only their own invoices
- Status column shows: Pending / Sent / Paid badges

### 6. Status badges
Add `completed` (blue) and `paid` (green-gold) to `statusBadge()`.

### 7. Fix `loadTotalEarned`
Current code queries non-existent `commission_amount` column. Fix:
- Admin: `SUM(amount)` from all paid invoices
- Agent: `SUM(amount) * 0.15` from their paid invoices

## Open Questions (pending Aaron's reply)
- After "Paid", does client auto-move to "Active" or does Aaron set it manually?
- n8n webhook URLs for invoice and receipt

## Out of Scope
- Invoice PDF generation (Python script to be integrated later)
- Manual invoice creation (auto-only for now)
- Per-invoice email re-send UI (use n8n for retries)
