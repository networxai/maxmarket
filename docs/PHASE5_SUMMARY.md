## Phase 5 — Summary

### What was built

- **Deterministic seed + test harness**
  - Added `prisma/seed.ts` with idempotent seeding via `runSeed()`:
    - Users: `super_admin@maxmarket.com`, `admin1@maxmarket.com`, `manager1@maxmarket.com`, `agent1@maxmarket.com`, `agent2@maxmarket.com`, `client1@maxmarket.com`.
    - Client group: `Default Clients`.
    - Agent–client assignment: `agent1` ↔ `client1`.
    - Catalog: seed category, product, variant (`SEED-SKU-1`) and two images.
    - Inventory: warehouse + stock row with `availableQty`/`reservedQty`.
    - Orders: draft/submitted/approved/fulfilled baseline orders.
  - Test helper `tests/helpers/seed.ts` exposes `ensureSeed()`; Phase 4–5 tests call this and no longer “return early and pass”.

- **Expanded tests (Phase 5)**
  - `tests/phase4.test.ts` updated to use seeded users and to fail fast when prerequisites are missing.
  - New `tests/phase5.test.ts`:
    - **Auth**: login, cookie-based refresh rotation, refresh-token reuse detection (401 UNAUTHORIZED), logout.
    - **Orders**: approve uses free stock (`available - reserved`) with explicit INSUFFICIENT_STOCK case; optimistic lock conflict on approve returns 409 OPTIMISTIC_LOCK_CONFLICT.
    - **Reports**: agent scoping enforced on `sales-by-client` (403 when unassigned), PDF export returns 501 NOT_IMPLEMENTED with standard envelope.
    - **Audit**: RBAC on audit log list + filtering returns `auth.login_attempt` entries after forced login events.

- **DB integrity & indexing**
  - Confirmed key unique constraints in `schema.prisma` (users.email, product_variants.sku, agent_client_assignments pair, warehouse_stock pair, orders.orderNumber, order_versions pair, translations).
  - Documented recommended indexes and integrity checks in `docs/DB_PERF_NOTES.md` for:
    - Orders (status/createdAt, clientId, agentId),
    - Order line items (orderId, variantId),
    - Warehouse stock (variantId, warehouseId),
    - Audit log (createdAt, eventType, actorId),
    - Non-negative stock and `reserved <= available`.

- **Operational hardening**
  - `/health` unchanged (no auth, returns `{ status: "ok" }`).
  - New `/ready` endpoint in `routes/health.ts`:
    - Executes `SELECT 1` via Prisma; returns 200 `{ status: "ok" }` or 503 `INTERNAL_ERROR` envelope if DB is not ready.
  - Added optional security middleware in `src/server.ts`:
    - Helmet and rate-limit plugins loaded dynamically (`@fastify/helmet`, `@fastify/rate-limit`), so tests still run without them installed.
  - Rate limiting configured per-route on auth endpoints (`/auth/login`, `/auth/refresh`).
  - Error handler updated to map 429 → `RATE_LIMITED` envelope (no schema changes needed).

- **OpenAPI drift prevention**
  - New `scripts/validate-openapi.ts` with `npm run openapi:lint` ensuring `contracts/openapi.yaml` is syntactically valid and has `openapi` + `paths`.
  - Added `docs/OPENAPI_DRIFT_CHECKLIST.md` with a manual drift-review checklist (routes vs OpenAPI, error responses, RBAC, business constraints, public catalog).
  - OpenAPI updated for variant-image reorder body (`imageIds` instead of `order`) to match implementation.

### How to run seed + tests

- **Run seed (dev/CI):**

```bash
cd services/api
npm install                 # ensure new deps installed
npm run db:seed            # runs prisma db seed -> tsx prisma/seed.ts
```

- **Run tests:**

```bash
cd services/api
npm run test
```

- **Run build:**

```bash
cd services/api
npm run build
```

Seed is idempotent; it is safe to run multiple times in local and CI environments.

