-- MaxMarket initial migration — matches docs/08_DB_SCHEMA.md
-- Prisma-generated base + order_number_seq, CHECKs, set_updated_at triggers, seed data

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema (public exists by default; IF NOT EXISTS for idempotency)
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."client_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "discount_type" VARCHAR(20) NOT NULL,
    "discount_value" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "client_groups_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."client_groups" ADD CONSTRAINT "client_groups_discount_type_check" CHECK (discount_type IN ('fixed','percentage'));

-- CreateTable
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "preferred_language" VARCHAR(5) NOT NULL DEFAULT 'en',
    "client_group_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."users" ADD CONSTRAINT "users_role_check" CHECK (role IN ('super_admin','admin','manager','agent','client'));
ALTER TABLE "public"."users" ADD CONSTRAINT "users_preferred_language_check" CHECK (preferred_language IN ('en','hy','ru'));
ALTER TABLE "public"."users" ADD CONSTRAINT "users_client_group_id_fkey" FOREIGN KEY ("client_group_id") REFERENCES "public"."client_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."agent_client_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_client_assignments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."agent_client_assignments" ADD CONSTRAINT "agent_client_assignments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."agent_client_assignments" ADD CONSTRAINT "agent_client_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" JSONB NOT NULL DEFAULT '{}',
    "parent_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID,
    "name" JSONB NOT NULL DEFAULT '{}',
    "description" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."product_variants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "unit_type" VARCHAR(20) NOT NULL,
    "min_order_qty" INTEGER NOT NULL DEFAULT 1,
    "cost_price" DECIMAL(12,4) NOT NULL,
    "price_per_unit" DECIMAL(12,4) NOT NULL,
    "price_per_box" DECIMAL(12,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_unit_type_check" CHECK (unit_type IN ('piece','box','kg'));
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."product_variant_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variant_images_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."product_variant_images" ADD CONSTRAINT "product_variant_images_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "stock_authority" VARCHAR(20) NOT NULL DEFAULT 'internal',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."warehouses" ADD CONSTRAINT "warehouses_stock_authority_check" CHECK (stock_authority IN ('internal','external'));

-- CreateTable
CREATE TABLE "public"."warehouse_stock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "warehouse_id" UUID NOT NULL,
    "product_variant_id" UUID NOT NULL,
    "available_qty" INTEGER NOT NULL DEFAULT 0,
    "reserved_qty" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_stock_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."warehouse_stock" ADD CONSTRAINT "warehouse_stock_available_qty_check" CHECK (available_qty >= 0);
ALTER TABLE "public"."warehouse_stock" ADD CONSTRAINT "warehouse_stock_reserved_qty_check" CHECK (reserved_qty >= 0);
ALTER TABLE "public"."warehouse_stock" ADD CONSTRAINT "warehouse_stock_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."warehouse_stock" ADD CONSTRAINT "warehouse_stock_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Order number sequence (FIX-DB2) — app generates MM-YYYY-NNNNNN via nextval
CREATE SEQUENCE IF NOT EXISTS "public"."order_number_seq" START 1 INCREMENT 1 NO CYCLE;

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_number" VARCHAR(50) NOT NULL,
    "client_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "version_lock" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sync_status" VARCHAR(20),
    "delivery_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_status_check" CHECK (status IN ('draft','submitted','approved','fulfilled','rejected','cancelled','returned'));
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."order_line_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_type" VARCHAR(20) NOT NULL,
    "base_price" DECIMAL(12,4) NOT NULL,
    "group_discount" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "manager_override" DECIMAL(12,4),
    "final_price" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."order_line_items" ADD CONSTRAINT "order_line_items_qty_check" CHECK (qty > 0);
ALTER TABLE "public"."order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."order_line_items" ADD CONSTRAINT "order_line_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."order_line_items" ADD CONSTRAINT "order_line_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."order_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "diff" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_versions_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."order_versions" ADD CONSTRAINT "order_versions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."order_versions" ADD CONSTRAINT "order_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "audit"."audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_type" VARCHAR(100) NOT NULL,
    "actor_id" UUID,
    "actor_role" VARCHAR(50),
    "target_type" VARCHAR(100),
    "target_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(45),
    "correlation_id" UUID,
    "cleared_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ui_translations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "language" VARCHAR(5) NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ui_translations_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "public"."ui_translations" ADD CONSTRAINT "ui_translations_language_check" CHECK (language IN ('en','hy','ru'));

-- CreateIndex
CREATE UNIQUE INDEX "client_groups_name_key" ON "public"."client_groups"("name");
CREATE INDEX "idx_users_email" ON "public"."users"("email");
CREATE INDEX "idx_users_role" ON "public"."users"("role");
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "idx_refresh_tokens_user" ON "public"."refresh_tokens"("user_id");
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "public"."refresh_tokens"("token_hash");
CREATE INDEX "idx_refresh_tokens_hash" ON "public"."refresh_tokens"("token_hash");
CREATE UNIQUE INDEX "agent_client_assignments_agent_id_client_id_key" ON "public"."agent_client_assignments"("agent_id", "client_id");
CREATE INDEX "idx_aca_agent" ON "public"."agent_client_assignments"("agent_id");
CREATE INDEX "idx_aca_client" ON "public"."agent_client_assignments"("client_id");
CREATE UNIQUE INDEX "product_variants_sku_key" ON "public"."product_variants"("sku");
CREATE INDEX "idx_variants_product" ON "public"."product_variants"("product_id");
CREATE INDEX "idx_pvi_variant" ON "public"."product_variant_images"("variant_id");
CREATE INDEX "idx_wstock_warehouse" ON "public"."warehouse_stock"("warehouse_id");
CREATE INDEX "idx_wstock_variant" ON "public"."warehouse_stock"("product_variant_id");
CREATE UNIQUE INDEX "warehouse_stock_warehouse_id_product_variant_id_key" ON "public"."warehouse_stock"("warehouse_id", "product_variant_id");
CREATE INDEX "idx_orders_client" ON "public"."orders"("client_id");
CREATE INDEX "idx_orders_agent" ON "public"."orders"("agent_id");
CREATE INDEX "idx_orders_status" ON "public"."orders"("status");
CREATE INDEX "idx_orders_created" ON "public"."orders"("created_at");
CREATE UNIQUE INDEX "orders_order_number_key" ON "public"."orders"("order_number");
CREATE INDEX "idx_oli_order" ON "public"."order_line_items"("order_id");
CREATE INDEX "idx_oli_variant" ON "public"."order_line_items"("variant_id");
CREATE INDEX "idx_ov_order" ON "public"."order_versions"("order_id");
CREATE UNIQUE INDEX "order_versions_order_id_version_number_key" ON "public"."order_versions"("order_id", "version_number");
CREATE INDEX "idx_auditlog_event" ON "audit"."audit_log"("event_type");
CREATE INDEX "idx_auditlog_actor" ON "audit"."audit_log"("actor_id");
CREATE INDEX "idx_auditlog_target" ON "audit"."audit_log"("target_type", "target_id");
CREATE INDEX "idx_auditlog_created" ON "audit"."audit_log"("created_at");
CREATE INDEX "idx_auditlog_cleared" ON "audit"."audit_log"("cleared_at") WHERE cleared_at IS NULL;
CREATE UNIQUE INDEX "ui_translations_language_key_key" ON "public"."ui_translations"("language", "key");
CREATE INDEX "idx_uitrans_language" ON "public"."ui_translations"("language");

-- set_updated_at trigger (FIX-DB3)
CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_client_groups_updated_at" BEFORE UPDATE ON "public"."client_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_categories_updated_at" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_product_variants_updated_at" BEFORE UPDATE ON "public"."product_variants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_warehouses_updated_at" BEFORE UPDATE ON "public"."warehouses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_warehouse_stock_updated_at" BEFORE UPDATE ON "public"."warehouse_stock" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_order_line_items_updated_at" BEFORE UPDATE ON "public"."order_line_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
CREATE TRIGGER "trg_ui_translations_updated_at" BEFORE UPDATE ON "public"."ui_translations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

-- Seed: default warehouse (08_DB_SCHEMA §8)
INSERT INTO "public"."warehouses" ("id", "name", "stock_authority", "is_active", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Main Warehouse', 'internal', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Seed: default Super Admin (password must be changed on first login; placeholder bcrypt hash for "ChangeMe1!")
INSERT INTO "public"."users" ("id", "email", "password_hash", "full_name", "role", "preferred_language", "is_active", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'admin@maxmarket.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G2icGj3v4oO8Ym',
  'System Admin',
  'super_admin',
  'en',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
