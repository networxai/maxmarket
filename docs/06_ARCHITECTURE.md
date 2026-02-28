# 06_ARCHITECTURE.md
## MaxMarket — System Architecture
**Version:** 1.0  
**Status:** Baseline Locked  
**Authority:** CTO_PACKET.md + 02_PRD.md + CTO_DECISION_ADDENDUM_v1.md

---

## 1. System Overview

MaxMarket is a closed B2B wholesale platform implemented as a **Modular Monolith** using Node.js (TypeScript) on the backend, PostgreSQL as the primary database, and React on the frontend. The system is single-seller, single-warehouse in v1, with the data model deliberately future-proofed for multi-warehouse and accounting sync in v2.

### Architecture Style

```
┌──────────────────────────────────────────────────────────┐
│                    React Web Client                       │
│                 (Responsive, no native app)               │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS / REST (JSON)
                          │ correlation_id on every request
┌─────────────────────────▼────────────────────────────────┐
│              Node.js Modular Monolith (TypeScript)        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Auth    │ │ Catalog  │ │  Orders  │ │  Inventory │  │
│  │ Module   │ │ Module   │ │  Module  │ │  Module    │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Pricing  │ │ Reports  │ │  Users   │ │  Audit     │  │
│  │ Module   │ │ Module   │ │  Module  │ │  Module    │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│  ┌──────────┐                                            │
│  │   I18n   │  (Translation Module)                      │
│  │ Module   │                                            │
│  └──────────┘                                            │
│                                                          │
│  Shared: JWT middleware, RBAC middleware, Zod validator, │
│  correlation_id injector, error formatter, logger        │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│                    PostgreSQL (Dockerized)                 │
│         Main DB + Audit DB (separate schema/table)        │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Module Boundaries

Each module owns its domain logic, its routes, its service layer, and its DB queries. Modules communicate synchronously via direct service function calls (not HTTP). No message broker in v1.

| Module | Responsibility |
|---|---|
| **auth** | JWT issuance, refresh token rotation, login/logout, session management |
| **users** | User CRUD, role assignment, client-agent assignment, client groups |
| **catalog** | Products, variants, categories, multilingual fields, public/priced views |
| **pricing** | Price computation (base − group discount), group discount rules |
| **inventory** | warehouse_stock records, reservation logic, stock adjustments |
| **orders** | Order lifecycle, state machine, versioning, line items |
| **reports** | Real-time report queries scoped by RBAC, CSV/PDF export |
| **audit** | Append-only event log, soft-delete clearing, audit queries |
| **i18n** | UI translation strings, language management (Super Admin) |

---

## 3. Request Lifecycle

```
Client Request
  → HTTPS
  → correlation_id middleware (inject/forward UUID)
  → rate limiter
  → auth middleware (verify JWT)
  → RBAC middleware (role + resource check)
  → Zod validation (body/query/params)
  → Route handler → Service → DB
  → Audit write (where applicable, same transaction)
  → JSON response (camelCase) or standard error
```

### Standard Error Format (all errors)

```json
{
  "errorCode": "INSUFFICIENT_STOCK",
  "message": "Approval blocked: insufficient stock for 2 line items",
  "details": [
    { "variantId": "uuid", "required": 50, "available": 30 }
  ],
  "correlationId": "uuid"
}
```

---

## 4. Authentication Architecture

- **Access token:** JWT, 15-minute expiry, signed with RS256 or HS256 (team choice), contains `userId`, `role`, `clientGroupId` (if Client)
- **Refresh token:** opaque UUID stored in `refresh_tokens` table, 7-day expiry, rotation on every use (old token invalidated, new issued)
- **Refresh token rotation:** if an already-used refresh token is presented, all tokens for that user are invalidated (replay detection)
- **Public routes:** `GET /catalog/*` (no pricing) — no auth required
- **All other routes:** require valid JWT

---

## 5. Modular Monolith Conventions

- Each module lives under `src/modules/<name>/`
- Structure per module:
  ```
  src/modules/orders/
    orders.router.ts      ← Express router
    orders.service.ts     ← Business logic
    orders.queries.ts     ← Raw SQL / query builder calls
    orders.types.ts       ← TypeScript types/interfaces
    orders.validation.ts  ← Zod schemas
  ```
- Shared code under `src/shared/`:
  - `middleware/auth.ts`
  - `middleware/rbac.ts`
  - `middleware/correlationId.ts`
  - `errors/errorFormatter.ts`
  - `errors/errorCodes.ts`
  - `logger/structuredLogger.ts`
  - `db/client.ts` (pg pool)
  - `db/transactions.ts`

---

## 6. Order State Machine

```
                  ┌────────┐
         Agent    │ DRAFT  │
         creates  └───┬────┘
                      │ Agent: Submit
                  ┌───▼────────┐
                  │ SUBMITTED  │
                  └───┬────┬───┘
          Manager     │    │ Manager
          Approve      │    │ Reject
              ┌───────▼┐  ┌▼──────────┐
              │APPROVED│  │ REJECTED  │ (terminal)
              └──┬──┬───┘  └───────────┘
     Manager     │  │ Admin Edit
     Fulfill     │  │ (new version)
         ┌───────▼┐ │ → new version resets to SUBMITTED
         │FULFILLED│ │   on new version record
         └───┬────┘ │
   Manager/  │      │ Manager/Admin
   Admin      │      │ Cancel
   Return  ┌──▼──┐  ┌▼───────────┐
            │RTRND│  │ CANCELLED  │ (terminal)
            └─────┘  └────────────┘
```

**State machine enforcement:** server-side only. Every transition validated in `orders.service.ts` before DB write. Invalid transitions return `ORDER_INVALID_TRANSITION` error.

**Optimistic locking:** `orders` table has `version_lock` integer column incremented on every write. Manager approve uses `WHERE id = $1 AND version_lock = $2` to prevent dual-approval (EC-ORD-05).

---

## 7. Inventory & Reservation Logic

All stock mutations within the same DB transaction as the order state change that triggers them.

```
APPROVE:   BEGIN
           check available_qty >= order_qty for all line items → error if not
           UPDATE warehouse_stock SET reserved_qty = reserved_qty + order_qty
           UPDATE orders SET status = 'approved'
           INSERT audit_log (...)
           COMMIT

FULFILL:   BEGIN
           UPDATE warehouse_stock
             SET reserved_qty = reserved_qty - order_qty,
                 available_qty = available_qty - order_qty
           UPDATE orders SET status = 'fulfilled'
           INSERT audit_log (...)
           COMMIT

CANCEL:    BEGIN
           UPDATE warehouse_stock SET reserved_qty = reserved_qty - order_qty
           UPDATE orders SET status = 'cancelled'
           INSERT audit_log (...)
           COMMIT

RETURN:    BEGIN
           UPDATE warehouse_stock SET available_qty = available_qty + order_qty
           UPDATE orders SET status = 'returned'
           INSERT audit_log (...)
           COMMIT

STOCK ADJ: BEGIN
           check new_qty >= reserved_qty → error if not
           UPDATE warehouse_stock SET available_qty = new_qty
           INSERT audit_log (...)
           COMMIT
```

**Version edit delta (DN-STK-02):** No stock change at edit time. Re-approval computes delta vs. previous approved version and applies reservation of delta only. If new qty < old qty, the difference is released from reserved.

---

## 8. Pricing Engine

Deterministic, no stacking:

```typescript
// Computed at order creation / submission time
function computeLinePrice(
  basePrice: number,
  groupDiscount: number,
  managerOverride?: number
): number {
  if (managerOverride !== undefined) return managerOverride;
  return basePrice - groupDiscount;
}
```

**Discount recalculation on submission (DN-PRICE-02):** When Agent submits a Draft, the service re-fetches current group discount rules and recalculates all line item prices before transitioning to Submitted. Approved/Fulfilled orders are never touched.

---

## 9. Order Versioning

- `orders` table stores the canonical current version
- `order_versions` table stores immutable snapshots of every approved state before Admin edit
- Version number is a sequential integer per logical order (starts at 1)
- A logical order is identified by `order_id`; `order_versions` has `(order_id, version_number)`
- When Admin edits: current order snapshot is written to `order_versions`, then the `orders` record is updated with new line items and status reset to `submitted`, version incremented
- Audit diff (field-level) stored in `audit_log` alongside the version creation event

---

## 10. Reporting

- All reports run as real-time SQL queries (DN-RPT-02)
- RBAC scoping applied at query level:
  - Admin/Manager: full data
  - Agent: `WHERE agent_id = $agentId` (DN-RPT-01)
- CSV: streamed via `csv-stringify`
- PDF: generated via `pdfkit` or `puppeteer` (team choice)
- All report endpoints require pagination params (or export flag)

---

## 11. Translation System

- Product multilingual fields stored as `jsonb` columns: `{ "en": "...", "hy": "...", "ru": "..." }`
- API returns the user's preferred language field; falls back to `en` if key missing (DN-LANG-01)
- UI translation strings stored in `ui_translations` table, managed by Super Admin via admin panel
- Frontend fetches translation bundle at init and on language switch
- Language codes: `en`, `hy`, `ru`

---

## 12. Audit System

- `audit_log` table is append-only (no UPDATE, no DELETE in application layer)
- "Clear logs" by Super Admin: soft-delete via `cleared_at` timestamp column on batch of records, preceded by an audit event recording the clear action
- Audit writes are in the same DB transaction as the action they record (FS-ORD-03)
- Separate `audit_log` table in same Postgres instance, different schema (`audit.audit_log`) to allow future separation

---

## 13. Catalog Visibility

| Viewer | Pricing Visible | Cost Price | Stock |
|---|---|---|---|
| Anonymous (public) | No | No | No |
| Client | Yes (group price) | No | No |
| Agent | Yes (group price + cost) | Yes | Yes |
| Manager | Yes (group price + cost) | Yes | Yes |
| Admin | Yes (all) | Yes | Yes |
| Super Admin | Yes (all) | Yes | Yes |

Public catalog endpoints (`GET /api/catalog/products`, `GET /api/catalog/products/:id`) require no auth. Price fields are excluded from response for unauthenticated requests.

---

## 14. v2 Preparedness

The following hooks are designed but not implemented in v1:

| Concern | v1 Design Decision |
|---|---|
| Multi-warehouse | `warehouse_id` FK exists on all stock records |
| Accounting sync | `sync_status` column reserved on `orders` (nullable, ignored v1) |
| Delivery tracking | `delivery_id` FK reserved on `orders` (nullable, ignored v1) |
| External stock authority | `stock_authority` flag on `warehouses` table (default `internal`) |
| Event hooks | Internal domain events emitted via typed `EventEmitter` (no external broker in v1); v2 can swap emitter for message queue |
| Mobile apps | REST API is mobile-compatible; no additional changes needed |

---

## 15. Non-Functional Targets

| Concern | Decision |
|---|---|
| Uptime | 99% (DN-NFR-01) |
| Backup | Daily automated, 30-day retention, manual restore (DN-NFR-02) |
| Session | 15-min access token, 7-day refresh (DN-NFR-03) |
| Scale | 100k products, 300–1000 clients, 50–100 orders/day, 20 concurrent users |
| Rate limiting | Applied to all endpoints; auth endpoints stricter |
| Indexing | SKU, product name (full-text or trigram), category FK from day one |
| Pagination | Mandatory on all list endpoints; default page size 20, max 100 |

---

## 16. Decision Needed (Architect)

### DA-01 — PDF Export Library

**Question:** Which PDF generation library to use for report exports?  
**Option A:** `pdfkit` — lightweight, no headless browser, simpler dep tree  
**Option B:** `puppeteer` — renders HTML templates, better for complex layouts, heavier  
**Option C:** External PDF service (SaaS) — offloads complexity, adds external dependency  
**Recommendation:** Option A for v1 given low concurrency and simple tabular reports.

### DA-02 — JWT Signing Algorithm

**Question:** RS256 (asymmetric) or HS256 (symmetric) for JWT signing?  
**Option A:** HS256 — simpler, single service, no key distribution needed  
**Option B:** RS256 — better practice if v2 adds microservices that need to verify tokens  
**Option C:** EdDSA — modern, compact, but less tooling support  
**Recommendation:** HS256 for v1 given single-service monolith; plan migration path for v2.

### DA-03 — Full-Text Search Strategy

**Question:** How to implement indexed search on product name for 100k products?  
**Option A:** PostgreSQL `tsvector` / `GIN` index with `to_tsvector` — native, no extra infra  
**Option B:** PostgreSQL `pg_trgm` trigram index — better for partial-word/prefix search  
**Option C:** Both GIN + trigram — covers more cases, slightly more index maintenance  
**Recommendation:** Option C (GIN for full-word + trigram for partial) unless team prefers simplicity, then Option A.
