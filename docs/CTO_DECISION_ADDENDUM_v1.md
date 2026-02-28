# CTO Decision Resolution Addendum — MaxMarket v1

Status: Finalized
Authority: CTO (Architecture Freeze)

This document resolves all “Decision Needed” items from PRD v1.0.
These rules are authoritative and override ambiguity.

---

## 1. Pricing Decisions

### DN-PRICE-01 — Manager Override Scope

Manager price override applies per line item only.
Override replaces the computed client-discounted price for that specific line item.
Override does not affect other line items.

### DN-PRICE-02 — Retroactive Discount Changes

Changes to client group discount rules:

- Affect new orders
- Affect existing Draft orders (price recalculated upon submission)
- Do NOT affect Approved or Fulfilled orders

---

## 2. Inventory Decisions

### DN-STK-01 — Return Restocking

Returned orders automatically increase available_qty.
No manual Admin confirmation required.

### DN-STK-02 — Stock Reservation on Version Edit

When Admin edits an Approved order:

- No stock change occurs at edit time.
- Stock delta is checked and reserved at re-approval.
- If insufficient stock, re-approval is blocked.

---

## 3. Reporting Decisions

### DN-RPT-01 — Agent Reporting Scope

Agents may access reporting data scoped strictly to their assigned clients.
Agents cannot access global reporting.

### DN-RPT-02 — Reporting Model

Reports are generated in real time.
No snapshot system in v1.

---

## 4. Language Decisions

### DN-LANG-01 — Translation Fallback

If a multilingual field is missing a translation:

- System falls back to English.
- Save operation is not blocked.

---

## 5. Non-Functional Decisions

### DN-NFR-01 — Availability Target

Target uptime: 99%.

### DN-NFR-02 — Backup Policy

- Daily automated backup.
- 30-day retention.
- Manual restore capability required.

### DN-NFR-03 — Session Management

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 7 days.

---

## 6. Order Workflow Decisions

### DN-ORD-01 — Rejection Reason

Manager may optionally provide a rejection reason.
Rejection reason is stored in audit.

### DN-ORD-02 — Cancellation Authority

Approved orders may be cancelled by:

- Manager
- Admin

---

Architecture Freeze Confirmed.
No further behavioral changes allowed without formal revision.
