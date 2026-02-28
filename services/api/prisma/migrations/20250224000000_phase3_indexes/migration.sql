-- Phase 3: composite indexes for orders list scoping
CREATE INDEX IF NOT EXISTS "idx_orders_status_client" ON "public"."orders"("status", "client_id");
CREATE INDEX IF NOT EXISTS "idx_orders_status_agent" ON "public"."orders"("status", "agent_id");
