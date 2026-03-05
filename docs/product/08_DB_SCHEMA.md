# 08_DB_SCHEMA.md
## MaxMarket — Database Schema
**Version:** 1.0  
**Engine:** PostgreSQL  
**Conventions:** UUID PKs, snake_case, created_at/updated_at on all tables, soft delete via deleted_at where noted

---

## Schema Organisation

```
public schema  — all application tables
audit schema   — audit_log (append-only, isolated)
```

---

## 1. Users & Auth

### users

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  full_name         VARCHAR(255) NOT NULL,
  role              VARCHAR(50) NOT NULL
                    CHECK (role IN ('super_admin','admin','manager','agent','client')),
  preferred_language VARCHAR(5) NOT NULL DEFAULT 'en'
                    CHECK (preferred_language IN ('en','hy','ru')),
  client_group_id   UUID REFERENCES client_groups(id) ON DELETE SET NULL,
                    -- only populated for role = 'client'
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ  -- soft delete
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### refresh_tokens

```sql
CREATE TABLE refresh_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    VARCHAR(255) NOT NULL UNIQUE,
                -- store SHA-256 hash, not raw token
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,  -- set when rotated; non-null = invalidated
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### agent_client_assignments

```sql
CREATE TABLE agent_client_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agent_id, client_id),
  CONSTRAINT chk_agent_role CHECK (
    -- enforced at app layer; here for documentation
    true
  )
);

CREATE INDEX idx_aca_agent ON agent_client_assignments(agent_id);
CREATE INDEX idx_aca_client ON agent_client_assignments(client_id);
```

---

## 2. Client Groups & Pricing

### client_groups

```sql
CREATE TABLE client_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL UNIQUE,
  discount_type   VARCHAR(20) NOT NULL CHECK (discount_type IN ('fixed','percentage')),
  discount_value  NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
```

**Notes:**
- `fixed`: absolute amount subtracted from base_price
- `percentage`: percentage of base_price subtracted
- One group per client; enforced via `users.client_group_id`
- Discount change affects new + Draft orders on next submission (DN-PRICE-02)

---

## 3. Catalog

### categories

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        JSONB NOT NULL DEFAULT '{}',
                -- { "en": "...", "hy": "...", "ru": "..." }
  parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
                -- v1: flat categories, parent_id reserved for v2
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

### products

```sql
CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  name         JSONB NOT NULL DEFAULT '{}',
               -- { "en": "...", "hy": "...", "ru": "..." }
  description  JSONB NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ  -- soft delete
);

-- Full-text search on English name (GIN index)
CREATE INDEX idx_products_name_en_fts
  ON products USING GIN (to_tsvector('english', name->>'en'));

-- Trigram index for partial-match search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_name_en_trgm
  ON products USING GIN ((name->>'en') gin_trgm_ops);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active) WHERE is_active = TRUE;
```

### product_variants

```sql
CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku             VARCHAR(100) NOT NULL UNIQUE,
  unit_type       VARCHAR(20) NOT NULL CHECK (unit_type IN ('piece','box','kg')),
  min_order_qty   INTEGER NOT NULL DEFAULT 1,
  cost_price      NUMERIC(12,4) NOT NULL,
  price_per_unit  NUMERIC(12,4) NOT NULL,
  price_per_box   NUMERIC(12,4),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku) WHERE deleted_at IS NULL;
CREATE INDEX idx_variants_product ON product_variants(product_id);

-- SKU index for search
CREATE INDEX idx_variants_sku_trgm
  ON product_variants USING GIN (sku gin_trgm_ops);
```

### product_variant_images

```sql
CREATE TABLE product_variant_images (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pvi_variant ON product_variant_images(variant_id);
```

---

## 4. Inventory

### warehouses

```sql
CREATE TABLE warehouses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  stock_authority  VARCHAR(20) NOT NULL DEFAULT 'internal'
                   CHECK (stock_authority IN ('internal','external')),
                   -- v2: 'external' means accounting system is authority
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v1: exactly one row inserted via migration (id = DEFAULT_WAREHOUSE_ID)
```

### warehouse_stock

```sql
CREATE TABLE warehouse_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id),
  available_qty     INTEGER NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty      INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_variant_id)
);

-- Constraint: available_qty must never be set below reserved_qty.
-- Enforced at APPLICATION LAYER ONLY (intentional — not a DB CHECK constraint).
-- Rationale: a DB CHECK on available_qty >= reserved_qty would evaluate mid-transaction
-- before all reservation deltas on multiple rows are committed, making atomic
-- multi-line-item stock reservation impossible. The application enforces this
-- atomically within a single transaction that updates all affected rows before commit.

CREATE INDEX idx_wstock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX idx_wstock_variant ON warehouse_stock(product_variant_id);
```

---

## 5. Orders

### order_number Sequence  (FIX-DB2)

```sql
-- Monotonic sequence for human-readable order numbers.
-- Guarantees uniqueness even under concurrent inserts.
-- Pattern: MM-YYYY-NNNNNN  (e.g. MM-2026-000001)
CREATE SEQUENCE IF NOT EXISTS order_number_seq
  START 1
  INCREMENT 1
  NO CYCLE;

-- Generation helper — called from application service layer during BEGIN/COMMIT:
--   order_number = 'MM-' || to_char(now(), 'YYYY') || '-'
--                  || LPAD(nextval('order_number_seq')::text, 6, '0');
-- Note: the year prefix is cosmetic; uniqueness is guaranteed by the global sequence,
-- so the sequence is NOT reset on year rollover (avoids reset-race risks).
```

### orders

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    VARCHAR(50) NOT NULL UNIQUE,
                  -- generated by app layer using order_number_seq
                  -- format: MM-YYYY-NNNNNN, e.g. "MM-2026-000001"
  client_id       UUID NOT NULL REFERENCES users(id),
  agent_id        UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'draft'
                  CHECK (status IN (
                    'draft','submitted','approved',
                    'fulfilled','rejected','cancelled','returned'
                  )),
  current_version INTEGER NOT NULL DEFAULT 1,
  version_lock    INTEGER NOT NULL DEFAULT 0,
                  -- optimistic locking for concurrent approval (EC-ORD-05)
  notes           TEXT,
  sync_status     VARCHAR(20),
                  -- reserved for v2 accounting sync, NULL in v1
  delivery_id     UUID,
                  -- reserved for v2 delivery tracking, NULL in v1
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ  -- soft delete for Agent delete of Draft
);

CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_agent ON orders(agent_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at);
```

### order_line_items

```sql
CREATE TABLE order_line_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id        UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
  qty               INTEGER NOT NULL CHECK (qty > 0),
  unit_type         VARCHAR(20) NOT NULL,
                    -- snapshot from product_variants.unit_type at order creation;
                    -- stored denormalised so order history is immune to product edits
  base_price        NUMERIC(12,4) NOT NULL,
                    -- captured at order creation from product_variants.price_per_unit
  group_discount    NUMERIC(12,4) NOT NULL DEFAULT 0,
                    -- captured at submission from client_groups.discount_value
  manager_override  NUMERIC(12,4),
                    -- set by Manager before approval; NULL if no override
  final_price       NUMERIC(12,4) NOT NULL,
                    -- = manager_override ?? (base_price - group_discount)
                    -- recomputed on submission
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oli_order ON order_line_items(order_id);
CREATE INDEX idx_oli_variant ON order_line_items(variant_id);
```

### order_versions

```sql
CREATE TABLE order_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  version_number  INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,
                  -- full snapshot of order + line items at time of version creation
  diff            JSONB,
                  -- field-level diff: [{field, oldValue, newValue}]
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, version_number)
);

CREATE INDEX idx_ov_order ON order_versions(order_id);
```

---

## 6. Audit

```sql
-- Separate schema for isolation
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE audit.audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,
  actor_id        UUID,         -- NULL for system events
  actor_role      VARCHAR(50),
  target_type     VARCHAR(100), -- e.g. 'order', 'product_variant', 'user'
  target_id       UUID,
  payload         JSONB NOT NULL DEFAULT '{}',
                  -- all event-specific data (see PRD §9)
  ip_address      INET,
  correlation_id  UUID,
  cleared_at      TIMESTAMPTZ,  -- soft delete by Super Admin
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — append-only, immutable
);

CREATE INDEX idx_auditlog_event ON audit.audit_log(event_type);
CREATE INDEX idx_auditlog_actor ON audit.audit_log(actor_id);
CREATE INDEX idx_auditlog_target ON audit.audit_log(target_type, target_id);
CREATE INDEX idx_auditlog_created ON audit.audit_log(created_at);
CREATE INDEX idx_auditlog_cleared ON audit.audit_log(cleared_at) WHERE cleared_at IS NULL;
```

**Audit event_type values:**

> ⚠️ Event type strings must match `contracts/events.json` exactly — they are stored verbatim in `event_type` and used as filter keys.

| event_type | Payload fields |
|---|---|
| `order.created` | orderId, agentId |
| `order.draft_edited` | orderId, agentId, changedFields |
| `order.submitted` | orderId, agentId, lineItems, pricesRecalculated |
| `order.approved` | orderId, managerId, stockReservations |
| `order.rejected` | orderId, managerId, reason |
| `order.fulfilled` | orderId, managerId, stockDecrements |
| `order.cancelled` | orderId, actorId, actorRole, stockReleases |
| `order.returned` | orderId, actorId, actorRole, stockRestorations |
| `order.version_created` | orderId, newVersionNumber, previousVersionNumber, adminId, diff, stockRecheckRequired |
| `order.price_override` | orderId, lineItemId, managerId, originalPrice, overridePrice |
| `stock.adjusted` | variantId, warehouseId, oldAvailableQty, newAvailableQty, reservedQty, adminId, reason |
| `auth.login_attempt` | attemptedEmail, userId, success, ipAddress, userAgent |
| `user.role_changed` | targetUserId, changedById, oldRole, newRole |
| `user.deactivated` | targetUserId, deactivatedById |
| `pricing.group_discount_changed` | groupId, adminId, oldDiscountType, oldDiscountValue, newDiscountType, newDiscountValue |
| `audit.logs_cleared` | clearedById, scope, beforeDate, clearedCount |

**Changes from previous version (Opus consistency pass):**
- `order.edited_draft` renamed → `order.draft_edited` (M1: matches events.json canonical name)
- `order.submitted` added (M3: was missing; required by PRD §9)
- `user.deactivated` added (M2: was missing; defined in events.json)
- `pricing.group_discount_changed` added (matches events.json)
- Payload fields aligned with events.json canonical schemas

---

## 7. I18n

### ui_translations

```sql
CREATE TABLE ui_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language    VARCHAR(5) NOT NULL CHECK (language IN ('en','hy','ru')),
  key         VARCHAR(255) NOT NULL,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (language, key)
);

CREATE INDEX idx_uitrans_language ON ui_translations(language);
```

---

## 8. Seed / Bootstrap Data

Required on first deploy (via migration):

```sql
-- Default warehouse
INSERT INTO warehouses (id, name, stock_authority)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Warehouse', 'internal');

-- Default Super Admin (password must be changed on first login)
-- password_hash to be set via setup script
INSERT INTO users (email, password_hash, full_name, role)
VALUES ('admin@maxmarket.com', '<bcrypt_hash>', 'System Admin', 'super_admin');
```

---

## 9. Migration Strategy

- All schema changes via numbered migration files: `migrations/0001_initial.sql`, `0002_...`
- Tool: `node-pg-migrate` or `db-migrate` (team choice)
- No destructive migrations in production without explicit sign-off
- **`updated_at` strategy: PostgreSQL trigger (resolved — FIX-DB3).**
  Using a trigger is preferred over application-layer updates because it fires on all writes
  including direct SQL (migrations, patches, admin queries) and cannot be accidentally omitted.

```sql
-- Reusable function — created once in 0001_initial.sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply to every table that has an updated_at column:
-- (Replace <table_name> with each table name below)
CREATE TRIGGER trg_<table_name>_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tables requiring this trigger:
-- users, client_groups, categories, products, product_variants,
-- warehouses, warehouse_stock, orders, order_line_items, ui_translations
```

---

## 10. Index Summary

| Table | Indexed Columns | Type |
|---|---|---|
| users | email, role | btree |
| product_variants | sku (unique partial), product_id | btree |
| products | category_id, is_active | btree |
| products | name->>'en' (FTS) | GIN tsvector |
| products | name->>'en' (partial match) | GIN trigram |
| product_variants | sku (partial match) | GIN trigram |
| warehouse_stock | warehouse_id, product_variant_id | btree |
| orders | client_id, agent_id, status, created_at | btree |
| order_line_items | order_id, variant_id | btree |
| order_versions | order_id | btree |
| audit.audit_log | event_type, actor_id, (target_type,target_id), created_at | btree |
