# MaxMarket — Decision Log

Record of implementation decisions that deviate from or clarify the OpenAPI/PRD.

---

## Phase 2 — Core Infra

### DL-01: Refresh token in httpOnly cookie only (CTO override)

**Source:** CTO locked decision — "Refresh token is httpOnly cookie."

**OpenAPI:** `POST /auth/login` 200 response schema includes `refreshToken` in body; `POST /auth/refresh` and `POST /auth/logout` request bodies require `refreshToken`.

**Implementation:**

- **Login:** Response body returns `accessToken` and `user` only. Refresh token is set only in an httpOnly cookie (`refreshToken`). No `refreshToken` in response body (avoids sending the same secret twice).
- **Refresh:** Refresh token is read from cookie first; if absent, from request body (for OpenAPI clients that send body).
- **Logout:** Token is read from cookie first, then from body; cookie is cleared.

**Rationale:** CTO decision takes precedence; cookie-only for refresh improves security. Body fallback on refresh/logout preserves compatibility with clients that send `refreshToken` in body.

---

## Phase 2 — CTO gate corrections (post-review)

### DL-02: Header casing and correlation ID

**Implementation:**

- All code uses the constant `CORRELATION_ID_HEADER = "X-Correlation-ID"` (exact casing per OpenAPI). Response header is set with this value; some runtimes may normalize to lowercase when reading.
- Correlation ID validation accepts any valid UUID format (OpenAPI `format: uuid`), not v4-only. Regex allows any version nibble.
- Every response (success, error, 404) includes `X-Correlation-ID`; every error body includes `correlationId`.

### DL-03: Error codes (401 and 409)

**Implementation:**

- **401:** Missing token → `TOKEN_MISSING`; expired token → `TOKEN_EXPIRED`; invalid/malformed/signature → `UNAUTHORIZED`. Auth middleware and auth routes use these deterministically.
- **409:** Optimistic lock (version conflict) → `OPTIMISTIC_LOCK_CONFLICT` (via `AppError(409, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, ...)`). Generic conflicts (SKU exists, already assigned, etc.) → `CONFLICT`. Fallback Fastify 409 remains `CONFLICT`.

### DL-04: Cookie security and refresh reuse

**Implementation:**

- Refresh cookie: `httpOnly: true`, `secure: true` in production, `sameSite: "lax"`, `path: "/api/v1/auth"`, `maxAge` aligned with refresh TTL (7 days).
- Logout clears cookie with same `path: "/api/v1/auth"`.
- Refresh token reuse: when detected, all tokens for the user are revoked, cookie is cleared (same path), and 401 response with `UNAUTHORIZED` and message "Refresh token already used; all sessions revoked" is returned.

### DL-05: Validation and 404

**Implementation:**

- Zod 422 details are standardized to an array of `{ path, message }` (no raw Zod objects).
- 404 notFound handler throws `AppError(404, NOT_FOUND, "Not Found")`; error handler returns the same envelope and sets `X-Correlation-ID`.

---

## Phase 3 — Report export

### DL-06: PDF export not implemented (501)

**OpenAPI:** `GET /reports/:reportType/export?format=pdf` may promise `application/pdf` binary stream.

**Implementation:**

- When `format=pdf` the endpoint returns **501 Not Implemented** with standard error envelope: `errorCode: "NOT_IMPLEMENTED"`, `message: "PDF export not implemented"`, `correlationId`.
- CSV export is implemented and returns `Content-Type: text/csv` with body as CSV string.
- OpenAPI should be updated to mark PDF as not implemented or remove `application/pdf` from produces until implemented.

**Rationale:** PDF binary generation deferred; 501 makes contract explicit and avoids returning a JSON stub while OpenAPI promises binary.

---

## Phase 4 — Domain modules + OpenAPI parity

### DL-07: Audit event names (client_group.*)

**Implementation:** Client groups audit events use `client_group.created`, `client_group.updated`, `client_group.deleted` (singular) per Phase 4 spec. Catalog audit uses `catalog.product_created`, `catalog.variant_created`, `catalog.variant_updated`, `catalog.variant_deleted`, `catalog.variant_image_added`, `catalog.variant_image_removed`, `catalog.variant_image_reordered`, `catalog.category_created`, `catalog.category_updated`, `catalog.category_deleted`.

### DL-08: Catalog admin constraints (409)

**Implementation:**

- **Variant SKU change:** Blocked (409 CONFLICT) when any non-draft/non-rejected/non-cancelled order references the variant (`countOrdersReferencingVariantSku`).
- **Variant delete:** Blocked (409 CONFLICT) when variant has active orders (`countActiveOrdersWithVariant`), where **active** is defined as orders with status not in `[draft, rejected, cancelled, returned]`.
- **Category delete:** Blocked (409 CONFLICT) when any products are assigned to the category (`countProductsInCategory`).
- **Client group delete:** Blocked (409 CONFLICT) when any clients are assigned (`countUsersInGroup`); already implemented, documented here.

### DL-09: Variant images reorder validation

**Implementation:** PUT .../variants/:variantId/images/reorder requires `imageIds` to be exactly the set of existing image IDs for that variant; unknown or duplicate IDs return 422 VALIDATION_ERROR with details.

---

## Phase 6 — Return flow (CTO-DEC-001)

### DL-10: Return does not auto-restore stock in v1

**Source:** CTO-DEC-001 (Phase 6 Directive).

**Decision:** On `POST /orders/{id}/return` (Fulfilled → Returned), stock is **not** automatically restored in v1. Return is an accounting/status marker only. Stock restoration (if needed) is performed manually via `PUT /inventory/stock/adjust` with audit reason.

**Rationale:** Avoids complexity around partial returns and keeps v1 simple. v2 may add automatic return-to-stock with line-item granularity.

**Implementation:** `returnOrderInTransaction` only updates order status to `returned`; it does not increment `warehouse_stock.available_qty`.

---

### DL-11: Discount type normalized to "percentage"

**Source:** CTO Phase 6 gate review.

**Issue:** Code accepted both "percent" and "percentage" for `discountType`, masking a data inconsistency.

**Resolution:** Canonical value is `percentage` per OpenAPI `ClientGroup.discountType: enum [fixed, percentage]`. All seed data, schema, and logic normalized. Dual-accept workaround removed.

---

## Phase 7 — Frontend

### DL-12: Frontend stack decision

**Source:** CTO-DEC-002, Phase 7 directive.

**Decision:** React + TypeScript + Vite SPA. UI: shadcn/ui (Tailwind). Server state: TanStack Query. Routing: React Router v6+. No Next.js/SSR.

**Rationale:** Closed B2B platform with REST API + JWT auth. SPA is the natural fit. No SSR needed. shadcn/ui provides accessible components without vendor lock-in.

---

## Phase 8 — Backend

### DL-13: OpenAPI return description corrected

**Source:** CTO Phase 8 directive.

**Issue:** OpenAPI `/orders/{id}/return` description said "available_qty += order_qty (auto-restocked)" which contradicted CTO-DEC-001 (DL-10) and the actual implementation.

**Resolution:** Description updated to state stock is NOT auto-restored on return in v1. Return is a status marker only.

---

### DL-14: Agent/client order list scoping fix

**Source:** QA Phase 8, BUG-002.

**Bug:** GET /orders did not filter by agentId for agent role or clientId for client role. Agents could see all orders in the list endpoint, violating data isolation.

**Fix:** Added role-based WHERE clause to listOrders query: agent → agentId filter, client → clientId filter. Detail endpoint (GET /orders/{id}) already had correct scoping.

---

### DL-15: Post-QA Phase 8 contract alignment fixes

**Source:** CTO Review of QA Phase 8 Results (2026-02-27).

**1. warehouseId optional with server default (deviation #1):**
- OpenAPI already documented warehouseId as optional with default. Implementation now accepts omitted warehouseId and defaults to `DEFAULT_WAREHOUSE_ID` (00000000-0000-0000-0000-000000000010) for v1 single-warehouse.
- Updated `createOrderBodySchema` and `updateOrderBodySchema`; service uses default when `warehouseId` is undefined.

**2. DELETE /orders/{id} response 204 (deviation #3):**
- Implementation already returned 204. OpenAPI updated: response changed from `200 Deleted` to `204 Deleted (no content)`.

**3. Price string serialization (deviation #4):**
- Prisma Decimal fields (basePrice, groupDiscount, finalPrice, managerOverride) serialize as strings in JSON. `createDraft` previously returned raw Prisma order including lineItems with Decimal. Fix: `createDraft` now passes lineItems through `lineItemsForRole()` which uses `Number()` for all price fields. `listOrders` and `getOrderById` already used `lineItemsForRole`. Draft order responses now return numbers.

**4. Empty body on state transitions (deviation #7):**
- Fastify throws `FST_ERR_CTP_EMPTY_JSON_BODY` when `Content-Type: application/json` is sent with empty body (e.g. POST /orders/{id}/submit with no body). Added `preParsing` hook: when content-type is application/json and content-length is 0 or absent, remove content-type header so Fastify does not invoke JSON parser. State transition endpoints (submit, approve, reject, fulfill, cancel, return) do not require a body.

---

### DL-16: Variant images returned as structured objects

**Source:** CTO-DEC-003, Phase 9 gate review.

**Issue:** Variant images were serialized as a flat URL array (`string[]`), preventing frontend from deleting or reordering existing images (no IDs available).

**Fix:** Images now returned as `{ id, url, sortOrder }[]`. `toPublicVariant` and `variantToProduct` in catalog service updated to map full image objects. OpenAPI `PublicProductVariant` and `ProductVariant` schemas updated accordingly. Images ordered by sortOrder ascending (already in repo includes).

---

### DL-17: Auto-create warehouse stock row on variant creation

**Source:** QA Phase 9, contract note #2.

**Issue:** New variants had no warehouse_stock row, making them invisible in inventory and causing order approval to fail (no stock to check against).

**Fix:** Variant creation now auto-creates a warehouse_stock row with availableQty=0, reservedQty=0 for the default warehouse. Applied to both `POST /catalog/products/{productId}/variants` (single variant) and `POST /catalog/products` (product with initial variants). Uses upsert to avoid unique constraint when row already exists (e.g. seed).

---

### DL-18: Sales-by-manager report groups by approving manager

**Source:** QA Phase 10.

**Issue:** The report returned `agentId`/`agentName` (order creator) instead of `managerId`/`managerName` (approving manager). OpenAPI SalesByManagerRow defines managerId/managerName.

**Fix:** Report now queries `audit.audit_log` for `orders.approved` events to determine which manager approved each order. Groups fulfilled orders by approver's actorId. Returns `{ managerId, managerName, orderCount, totalRevenue }`. Orders without an approve event (e.g. seed data inserted directly) are excluded.

---

### DL-19: Production hardening

**Phase:** 12.

**Changes:**

- Security headers via @fastify/helmet (contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: same-origin)
- CORS configured with explicit origin (CORS_ORIGIN) and credentials: true
- Rate limiting: global 200/min; login 10/15min with RATE_LIMITED error code
- Health check endpoint at /health (DB ping via prisma.$queryRaw)
- Production logging with LOG_LEVEL
- Body size limit explicit at 1MB
- Sensitive data audit verified

---

### DL-20: Display names added alongside user/entity IDs in API responses

**Source:** CTO-DEC-004, post-launch UX review.

**Issue:** UI displayed raw UUIDs for clients, agents, products. Not user-friendly.

**Fix:** Added *Name fields (clientName, agentName, actorName, productName) alongside existing ID fields in order, audit, and inventory responses. Order line items now include sku and productName. Response shape additions only — no existing fields changed. agentName stripped for client role (same as agentId).

---

## End of log
