## MaxMarket DB Performance & Integrity Notes (Phase 5)

### Constraints (existing + confirmed)

- `users.email` — unique (`User.email @unique`).
- `product_variants.sku` — unique (`ProductVariant.sku @unique`).
- `agent_client_assignments.agent_id, client_id` — unique pair (`@@unique([agentId, clientId])`).
- `warehouse_stock.warehouse_id, product_variant_id` — unique pair (`@@unique([warehouseId, productVariantId])`).
- `orders.order_number` — unique (`Order.orderNumber @unique`).
- `order_versions.order_id, version_number` — unique pair (`@@unique([orderId, versionNumber])`).
- `ui_translations.language, key` — unique pair (`@@unique([language, key])`).

### Indexes (schema-level)

- **Orders**
  - Add composite index on `(status, created_at)` for dashboard and worklist queries.
  - Add single-column indexes on `client_id` and `agent_id` for client/agent order history.
- **Order line items**
  - Add composite index on `(order_id, variant_id)` for join-heavy reporting and stock calculations.
- **Warehouse stock**
  - Unique `(warehouse_id, product_variant_id)` already present; recommended additional index on `(product_variant_id, warehouse_id)` for variant-centric stock lookups.
- **Audit log**
  - Add indexes on:
    - `created_at` (time-based range scans),
    - `(event_type, created_at)` (filter by type then time),
    - `(actor_id, created_at)` (actor-scoped audit views).

> NOTE: Prisma schema changes define these indexes; apply them via `prisma migrate dev` / `prisma migrate deploy` against your environments.

### Integrity checks (business-level)

- **Warehouse stock**
  - Logical invariant: `available_qty >= 0`, `reserved_qty >= 0`, and `reserved_qty <= available_qty`.
  - Enforced in application services using transactions (Phase 2–3 inventory/order flows); DB-level CHECK constraints are recommended for production Postgres:
    - `CHECK (available_qty >= 0 AND reserved_qty >= 0 AND reserved_qty <= available_qty)`.
- **Order line items**
  - Logical invariant: `qty > 0`.
  - Application-level validation is in place; a CHECK constraint `CHECK (qty > 0)` is safe for production.

These constraints and indexes should be revisited whenever new high-volume queries or new stock/status flows are introduced.

