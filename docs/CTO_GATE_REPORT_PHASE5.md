## MaxMarket — Phase 5 CTO Gate Report

Date: 2026-02-23  
Scope: Phase 5 (seed, tests, DB integrity, ops, OpenAPI drift)

---

### Task 1 — Deterministic Seed + Test Harness

**Result: PASS**

- **Seed implementation**
  - File: `services/api/prisma/seed.ts` (`runSeed()`).
  - Data seeded (idempotent via `upsert`):
    - Users:
      - `super_admin@maxmarket.com` (role `super_admin`)
      - `admin1@maxmarket.com` (role `admin`)
      - `manager1@maxmarket.com` (role `manager`)
      - `agent1@maxmarket.com`, `agent2@maxmarket.com` (role `agent`)
      - `client1@maxmarket.com` (role `client`, in client group)
    - Client group:
      - `Default Clients` with discount (percentage).
    - Agent-client assignment:
      - `agent1` ↔ `client1` (`AgentClientAssignment` upsert on unique pair).
    - Catalog:
      - Seed category (fixed UUID), product (fixed UUID), and variant `SEED-SKU-1` with basic pricing fields.
      - Two variant images (URLs).
    - Inventory:
      - Seed warehouse (fixed UUID) and `WarehouseStock` row with `availableQty` and `reservedQty`.
    - Orders:
      - Draft, submitted, approved, fulfilled orders referencing the seeded variant and warehouse.
  - Users are upserted by unique `email`, resetting `isActive = true` and `deletedAt = null` on re‑seed.

- **Test harness**
  - Helper: `services/api/tests/helpers/seed.ts`:
    - Exposes `ensureSeed()` which calls `runSeed()` once per test process.
  - Phase 4 and Phase 5 tests call `await ensureSeed()` and **no longer rely on silent early returns**:
    - Preconditions are asserted (e.g. admin token present, order exists); failures now show as test failures, not silent passes.

---

### Task 2 — Expanded Deterministic Tests

**Result: PASS**

- **Auth (Phase 5 tests)**
  - File: `services/api/tests/phase5.test.ts`.
  - **Login + refresh rotation + logout + reuse detection**:
    - Logs in as `super_admin@maxmarket.com`, extracts `refreshToken` cookie from `Set-Cookie`.
    - Calls `POST /api/v1/auth/refresh` with cookie → 200 and new `accessToken` + `refreshToken`.
    - Reuses the original cookie → 401 with `errorCode === UNAUTHORIZED` and `correlationId` (refresh reuse detection).
    - Logout returns 200.

- **Catalog**
  - Phase 3 tests (unchanged) still assert **public catalog price stripping** for:
    - `GET /api/v1/catalog/products` (list),
    - `GET /api/v1/catalog/products/:id` (detail),
    - `GET /api/v1/catalog/categories`.
  - Phase 4 tests (`tests/phase4.test.ts`) now run deterministically with seed:
    - Variant SKU update blocked → 409 when any non-draft/non-rejected/non-cancelled order references the variant.
    - Variant images reorder with unknown IDs → 422 `VALIDATION_ERROR` with envelope and `correlationId`.

- **Orders**
  - File: `tests/phase5.test.ts`.
  - **Free stock = available - reserved**:
    - Creates a new `submitted` order against the seeded variant/warehouse.
    - Sets `availableQty = reservedQty + qty - 1` (so `free = qty - 1`).
    - `POST /api/v1/orders/{id}/approve` as `manager1` returns 422 with `errorCode === INSUFFICIENT_STOCK` and non-empty `details` and `correlationId`.
  - **Optimistic lock conflict**:
    - Uses seeded `SEED-SUBMITTED-1` order.
    - Manually bumps `versionLock` in DB before calling approve.
    - `POST /api/v1/orders/{id}/approve` returns 409 with `errorCode === OPTIMISTIC_LOCK_CONFLICT` when conflict path is hit.

- **Reports**
  - File: `tests/phase5.test.ts`.
  - **Agent scoping**:
    - Logs in as `agent1`, upserts an `unassigned-client@maxmarket.com` user.
    - Calls `GET /api/v1/reports/sales-by-client?clientId=unassigned_client` → 403 with `FORBIDDEN` and `correlationId`.
  - **Export PDF**:
    - Logs in as `super_admin`, calls `GET /api/v1/reports/sales-by-date/export?format=pdf` → 501 with `errorCode === NOT_IMPLEMENTED`, expected message, and no `details`.

- **Audit**
  - File: `tests/phase5.test.ts`.
  - Logs in as `super_admin`, then triggers a login as `agent1` to generate `auth.login_attempt`.
  - Calls `GET /api/v1/audit/logs?...eventType=auth.login_attempt` as super_admin → 200 with `data[]` including events where `eventType === "auth.login_attempt"`.

All of the above tests assume seeded data and fail deterministically when prerequisites change, removing the prior “return early and pass” behavior for Phase 4+5 flows.

---

### Task 3 — DB Integrity + Indexing

**Result: PASS** (after Phase 6 index verification and optional migration)

- **Indexes required by CTO_PACKET §12 and Phase 6 Directive**
  - **Product name (multilingual / search):** `docs/08_DB_SCHEMA.md` specifies GIN/trigram on `name->>'en'`. Initial migration did not include this; Phase 6 adds it via raw SQL (pg_trgm extension + GIN index on `(name->>'en')`) in migration `20250224100000_phase6_indexes` if not already present.
  - **Variant SKU:** Unique index exists (`product_variants_sku_key`). Search/trigram index for partial match is added in Phase 6 migration where applicable.
  - **Category ID on products:** Phase 6 migration adds `idx_products_category_id` on `products(category_id)` for category filtering.
  - **Order status + clientId + agentId:** Present — `idx_orders_status`, `idx_orders_client`, `idx_orders_agent` (initial); `idx_orders_status_client`, `idx_orders_status_agent` (Phase 3). Verified.
  - **Audit eventType + actorId + createdAt:** Present — `idx_auditlog_event`, `idx_auditlog_actor`, `idx_auditlog_created` in initial migration. Verified.
  - **warehouse_stock composite:** Present — `warehouse_stock_warehouse_id_product_variant_id_key` unique on `(warehouse_id, product_variant_id)`. Verified.

- **Foreign key constraints**
  - All FKs from schema verified in initial migration: users→client_groups, refresh_tokens→users, agent_client_assignments→users, categories→parent, products→categories, product_variants→products, product_variant_images→product_variants, warehouse_stock→warehouses/product_variants, orders→users (client_id, agent_id), order_line_items→orders/variants/warehouses, order_versions→orders/users. No missing FKs.

- **Soft-delete consistency**
  - `deletedAt IS NULL` applied in queries: auth (users), catalog (products, variants, categories, client_groups), orders (baseWhere), users, client-groups, reports (orders). No live listing or get-by-id omits `deletedAt: null` for soft-deletable entities. Verified.

- **Phase 6 follow-up**
  - Migration `20250224100000_phase6_indexes` adds any remaining indexes (products.category_id, product name trigram, variant SKU trigram) per CTO_PACKET §12. Gate report Phase 6 confirms final index set.

