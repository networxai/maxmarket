# MaxMarket — Seed Data (Phase 8)

Seed is idempotent: `npx prisma db seed` can be run multiple times (upsert pattern).  
**Password for all seed users:** `ChangeMe1!`

---

## Seed Users

| Email | Role | Full Name | Client Group | Agent Assignment |
|-------|------|-----------|--------------|------------------|
| super_admin@maxmarket.com | super_admin | Super Admin | — | — |
| admin1@maxmarket.com | admin | Admin One | — | — |
| manager1@maxmarket.com | manager | Manager One | — | — |
| agent1@maxmarket.com | agent | Agent One | — | — |
| agent2@maxmarket.com | agent | Agent Two | — | — |
| client1@maxmarket.com | client | Client One | Default Clients (10%) | agent1 |
| client2@maxmarket.com | client | Client Two | Premium Clients (15%) | agent1 |
| client3@maxmarket.com | client | Client Three | Default Clients (10%) | agent2 |

---

## Client Groups

| Name | Discount Type | Discount Value |
|------|---------------|----------------|
| Default Clients | percentage | 10 |
| Premium Clients | percentage | 15 |

---

## Seed Orders

| Order Number | Status | Client | Agent | Notable Traits |
|--------------|--------|--------|-------|-----------------|
| SEED-DRAFT-1 | draft | client1 | agent1 | — |
| SEED-DRAFT-2 | draft | client3 | agent2 | — |
| SEED-SUBMITTED-1 | submitted | client1 | agent1 | — |
| SEED-SUBMITTED-2 | submitted | client2 | agent1 | — |
| SEED-APPROVED-1 | approved | client1 | agent1 | — |
| SEED-APPROVED-2 | approved | client3 | agent2 | — |
| SEED-FULFILLED-1 | fulfilled | client1 | agent1 | — |
| SEED-FULFILLED-2 | fulfilled | client2 | agent1 | — |
| SEED-REJECTED-1 | rejected | client3 | agent2 | — |
| SEED-CANCELLED-1 | cancelled | client1 | agent1 | — |
| SEED-RETURNED-1 | returned | client2 | agent1 | — |
| SEED-MULTILINE-1 | draft | client1 | agent1 | 3+ line items |
| SEED-OVERRIDE-1 | submitted | client2 | agent1 | Manager price override on line item |
| SEED-VERSIONED-1 | submitted | client1 | agent1 | Version history (order_versions row) |

---

## Catalog (Seed)

- **Categories:** Beverages, Snacks, Household
- **Products:** 10 total (e.g. Seed Product, Cola, Juice, Water, Chips, Cookies, Crackers, Soap, Tissue, Cleaner)
- **Variants:** 1–3 per product; varied SKUs (SEED-SKU-1, BEV-COLA-1, BEV-COLA-6, etc.), prices, unit types (piece/box)
- **Warehouse stock:** One seed warehouse; some variants with low stock (e.g. availableQty: 5, reservedQty: 3) for insufficient-stock testing
