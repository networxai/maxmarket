-- Phase 6: CTO_PACKET §12 — product name (trigram), category_id on products, variant SKU search
CREATE INDEX IF NOT EXISTS "idx_products_category_id" ON "public"."products"("category_id");

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for product name search (multilingual: en key)
CREATE INDEX IF NOT EXISTS "idx_products_name_en_trgm"
  ON "public"."products" USING GIN ((name->>'en') gin_trgm_ops);

-- Trigram index for variant SKU partial search
CREATE INDEX IF NOT EXISTS "idx_variants_sku_trgm"
  ON "public"."product_variants" USING GIN (sku gin_trgm_ops);
