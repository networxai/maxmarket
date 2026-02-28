# CONSISTENCY_REPORT.md
## MaxMarket — Opus Final Gate Consistency Pass
**Date:** 2026-02-23  
**Audited Artifacts:**
- `docs/CTO_PACKET.md` (source of truth)
- `docs/02_PRD.md` (source of truth)
- `docs/CTO_DECISION_ADDENDUM_v1.md` (source of truth)
- `docs/08_DB_SCHEMA.md`
- `docs/09_RBAC_SECURITY.md`
- `contracts/openapi.yaml`
- `contracts/rbac.json`
- `contracts/events.json`

---

## Mandatory Standards Verification

| Standard | Status | Notes |
|---|---|---|
| `correlation_id` required on every request | ✅ PASS | X-Correlation-ID request/response header; DB audit_log column; middleware in §5.3 |
| Error envelope consistent everywhere | ⚠️ PARTIAL | `ErrorResponse` schema is correct; HTTP status for VALIDATION_ERROR is 400 vs 422 (see FIX-O14) |
| Price fields cannot be client-controlled | ✅ PASS | `POST /orders` and `PUT /orders` accept only variantId + qty; overridePrice restricted to manager role |
| Optimistic locking on approve | ✅ PASS | `versionLock` required in `POST /orders/{id}/approve` body |
| Optimistic locking on version edit | ✅ PASS | `versionLock` required in `PUT /orders/{id}` for Admin editing Approved order |
| Public catalog OMITS price fields entirely | ✅ PASS | `PublicProduct` / `PublicProductVariant` have zero price fields; catalog GET endpoints carry `security: []` |
| Stock constraints documented | ✅ PASS | `STOCK_BELOW_RESERVED` on `/inventory/stock/adjust`; `INSUFFICIENT_STOCK` with `InsufficientStockDetail` on `/approve` |

---

## Issues Found

### CRITICAL
*None.*

---

### HIGH — Must Fix Before Production

---

#### FIX-O1 — Report endpoints have no response body schemas
**Severity:** HIGH  
**Source PRD:** §7.1 (four named reports), §7.2 (CSV/PDF export)  
**Affected file:** `contracts/openapi.yaml`  
**Endpoints:** `GET /reports/sales-by-date`, `GET /reports/sales-by-manager`, `GET /reports/sales-by-client`, `GET /reports/sales-by-product`  
**Problem:** All four report GET endpoints return a `200` with only a `description:` string and no `content:` block. No response schema exists. Implementors have nothing to code against; frontend teams cannot generate types.  
**Fix applied:** Added `SalesReportRow` and `SalesByManagerRow` schemas to components/schemas. Added full paginated `content: application/json` response blocks to all four report endpoints.

---

#### FIX-O6/O7 — Missing 403 responses on all order action endpoints
**Severity:** HIGH  
**Source PRD:** §10 "RBAC enforced server-side"  
**Affected file:** `contracts/openapi.yaml`  
**Endpoints:** `POST /orders/{id}/approve`, `POST /orders/{id}/reject`, `POST /orders/{id}/fulfill`, `POST /orders/{id}/cancel`, `POST /orders/{id}/return`, `GET /orders/{id}/versions`, `GET /orders/{id}/versions/{versionNumber}`  
**Problem:** Every role-restricted endpoint can return `403 Forbidden` when called by a non-permitted role, but none of these endpoints document a `403` response. This leaves client implementors unaware of the 403 case and cannot generate correct error-handling code.  
**Fix applied:** Added `403` response with `$ref: '#/components/schemas/ErrorResponse'` to each affected endpoint.

---

#### FIX-O14 — VALIDATION_ERROR HTTP status code conflict: 09_RBAC_SECURITY.md says 400, openapi uses 422
**Severity:** HIGH  
**Affected file:** `docs/09_RBAC_SECURITY.md §5.2`  
**Problem:** `09_RBAC_SECURITY.md §5.2` states: *"On failure: returns VALIDATION_ERROR (400) with Zod error details."* The entire `contracts/openapi.yaml` uses HTTP `422 Unprocessable Entity` for all validation errors. These are directly contradictory. HTTP 400 (Bad Request) is for malformed/unparseable requests. HTTP 422 is the correct semantic for valid JSON that fails business schema validation (as Zod produces). Since 422 is correct and used consistently in openapi, the RBAC doc is the error.  
**Fix applied:** Updated `09_RBAC_SECURITY.md §5.2` to read `VALIDATION_ERROR (422)`.

---

#### FIX-S2 — Manager permission for "view pricing rules" conflicts between rbac.json and 09_RBAC_SECURITY.md
**Severity:** HIGH  
**Affected file:** `docs/09_RBAC_SECURITY.md §2.5`  
**Problem:** `contracts/rbac.json` grants `client_groups.list: manager: true`. `contracts/openapi.yaml` `GET /client-groups` documents "Roles: super_admin, admin, manager, agent." But `09_RBAC_SECURITY.md §2.5 Pricing Rules` table shows `manager = ❌` for "View pricing rules." This is an internal three-way conflict between rbac.json, openapi, and the RBAC security doc. Managers approve orders and override prices; they need visibility of group discount rules to do their job. `rbac.json` and `openapi.yaml` are correct.  
**Fix applied:** Updated `09_RBAC_SECURITY.md §2.5` table: Manager row for "View pricing rules (client groups)" changed from `❌` to `✅`.

---

### MEDIUM — Should Fix Before Development

---

#### FIX-O8 — Missing 403 on GET /users/{agentId}/clients
**Severity:** MEDIUM  
**Affected file:** `contracts/openapi.yaml`  
**Problem:** An agent requesting `GET /users/{agentId}/clients` for a different agent's ID should receive `403 Forbidden`. This case is enforced by the service layer (`scoped_own_assignments` in rbac.json) but not documented in the openapi spec.  
**Fix applied:** Added `403` response to `GET /users/{agentId}/clients`.

---

#### FIX-O10 — Order.agentId client-role stripping undocumented in schema
**Severity:** MEDIUM  
**Source:** `09_RBAC_SECURITY.md §5.6` ("agentId stripped for client")  
**Affected file:** `contracts/openapi.yaml` — `Order` schema  
**Problem:** `09_RBAC_SECURITY.md §5.6` states `agentId` is stripped (null) for the client role, but the `Order` schema `agentId` field has no description or nullable indicator. Server implementors might not strip it; client implementors will not know it can be null.  
**Fix applied:** Added `nullable: true` and a description note to `Order.agentId`.

---

#### FIX-O11 — Draft order line item price fields ambiguous at creation stage
**Severity:** MEDIUM  
**Source:** DB schema note "group_discount captured at submission"; openapi note "prices computed on submission"  
**Affected file:** `contracts/openapi.yaml`  
**Problem:** `POST /orders` says prices are NOT set by caller and are computed on submission. But the response is `$ref: Order` → `OrderLineItem` which includes `groupDiscount` and `finalPrice`. At Draft creation: `groupDiscount = 0` (not yet captured) and `finalPrice = basePrice` (from `pricePerUnit` at creation time). This is inconsistent with the "computed on submission" wording and will confuse frontend implementors.  
**Fix applied:** Added clarifying description to `POST /orders` body and to `OrderLineItem.groupDiscount` and `OrderLineItem.finalPrice`: at Draft stage `groupDiscount = 0` and `finalPrice = basePrice`; both are recalculated on submission from the then-current group discount rule.

---

#### FIX-O12/O13 — Undefined decision references DA-05 and DA-06 in openapi
**Severity:** MEDIUM  
**Affected file:** `contracts/openapi.yaml`  
**Problem:** `PUT /catalog/products/{productId}/variants/{variantId}` description references "DA-05: SKU change blocked if non-Draft orders exist." `POST /catalog/products/{productId}/variants/{variantId}/images` references "DA-06 if binary upload is needed." Neither DA-05 nor DA-06 is defined anywhere in any source document or decision addendum. These are phantom references that will create confusion.  
**Fix applied:** Replaced phantom references with inline business rule descriptions. Added DA-05 and DA-06 to the Decision Needed section of the openapi info block.

---

#### FIX-DB2 — order_number generation strategy undefined
**Severity:** MEDIUM  
**Affected file:** `docs/08_DB_SCHEMA.md`  
**Problem:** `orders.order_number` is `VARCHAR(50) NOT NULL UNIQUE` with only a comment example. No sequence, trigger, or generation logic is defined. Concurrent order creation without an atomic generation mechanism risks duplicate key errors or gaps.  
**Fix applied:** Added `CREATE SEQUENCE order_number_seq` and a generation note: order_number is constructed as `'MM-' || to_char(now(), 'YYYY') || '-' || LPAD(nextval('order_number_seq')::text, 6, '0')` via trigger or application function.

---

#### FIX-DB3 — updated_at maintenance strategy left as open choice
**Severity:** MEDIUM  
**Affected file:** `docs/08_DB_SCHEMA.md §9`  
**Problem:** §9 reads "`updated_at` maintained via PostgreSQL trigger or application layer (consistent choice required)." This defers a required decision to implementation time. Without a declared standard, different modules will use different approaches, causing inconsistency.  
**Fix applied:** Resolved to PostgreSQL trigger approach. Added `set_updated_at()` trigger function and per-table trigger declaration template to §9.

---

### LOW — Track / Documentation Gaps

---

#### FIX-DB1 — warehouse_stock app-layer constraint missing rationale comment
**Severity:** LOW  
**Affected file:** `docs/08_DB_SCHEMA.md`  
**Problem:** The comment "Enforced at application layer (not DB CHECK to allow atomic deltas)" is correct but unexplained. Future engineers may add a CHECK constraint without understanding why it was intentionally omitted.  
**Fix applied:** Added explanatory comment: a DB CHECK on `available_qty >= reserved_qty` would fire mid-transaction before reservation deltas complete, making atomic multi-row stock reservation impossible.

---

#### FIX-DB4 — order_line_items.unit_type origin undocumented
**Severity:** LOW  
**Affected file:** `docs/08_DB_SCHEMA.md`  
**Problem:** `unit_type` in `order_line_items` is a snapshot field captured from `product_variants.unit_type` at order creation. No comment explains this, making it unclear whether this is a FK, a computed field, or free text.  
**Fix applied:** Added inline comment: "snapshot from product_variants.unit_type at order creation."

---

## New Decision Needed Items

These items were referenced in the artifacts but have no resolution in any source document.

| ID | Area | Question |
|---|---|---|
| DA-05 | Catalog — Variant | Can an Admin change a variant's SKU if non-Draft, non-Rejected, non-Cancelled orders reference it? Recommendation: Block if any such orders exist. |
| DA-06 | Catalog — Images | Does image management require binary file upload (multipart/form-data) or URL-only reference? v1 spec currently assumes URL-only (CDN pre-upload pattern). |

---

## Full Change Summary by File

### contracts/openapi.yaml (corrected version delivered)
| Fix ID | Change |
|---|---|
| FIX-O1 | Added `SalesReportRow`, `SalesByManagerRow` schemas; added response schemas to all 4 report GET endpoints |
| FIX-O6/O7 | Added `403` responses to `/approve`, `/reject`, `/fulfill`, `/cancel`, `/return`, `/versions` list and detail |
| FIX-O8 | Added `403` response to `GET /users/{agentId}/clients` |
| FIX-O10 | `Order.agentId`: added `nullable: true` and client-stripping description |
| FIX-O11 | `POST /orders` description and `OrderLineItem.groupDiscount` / `finalPrice`: added Draft-stage pricing behaviour notes |
| FIX-O12/O13 | Replaced DA-05/DA-06 phantom references with inline rule descriptions; added DA-05 and DA-06 to Decision Needed in info block |

### docs/09_RBAC_SECURITY.md (corrected version delivered)
| Fix ID | Change |
|---|---|
| FIX-O14 | §5.2: VALIDATION_ERROR status corrected from `(400)` to `(422)` |
| FIX-S2 | §2.5 Pricing Rules table: Manager "View pricing rules (client groups)" changed from ❌ to ✅ |

### docs/08_DB_SCHEMA.md (corrected version delivered)
| Fix ID | Change |
|---|---|
| FIX-DB2 | Added `order_number_seq` sequence definition and generation note |
| FIX-DB3 | Resolved `updated_at` strategy to PostgreSQL trigger; added `set_updated_at()` function and trigger template |
| FIX-DB1 | Added rationale comment on app-layer-only enforcement of stock constraint |
| FIX-DB4 | Added `unit_type` snapshot origin comment to `order_line_items` |

### contracts/rbac.json
*No changes required.* All permissions verified consistent with PRD, CTO_PACKET, and Addendum.

### contracts/events.json
*No changes required.* All event types, payload fields, and consumer declarations verified consistent.

---

## Verified Consistent (No Changes Required)

| Item | Verified Against |
|---|---|
| DN-STK-01 (auto-restock on return) | DB schema, openapi /return, events.json order.returned |
| DN-STK-02 (delta reserved at re-approval) | openapi PUT /orders description, events.json order.version_created |
| DN-PRICE-01 (per-line-item override) | openapi /override-price, rbac.json override_line_price, events.json order.price_override |
| DN-PRICE-02 (recalc on submit) | openapi /submit, events.json order.submitted.pricesRecalculated, DB comment |
| DN-ORD-01 (optional rejection reason) | openapi /reject body reason nullable, events.json order.rejected |
| DN-ORD-02 (cancel by Manager+Admin+SuperAdmin) | openapi /cancel, rbac.json orders.cancel, RBAC matrix |
| DN-RPT-01 (agent scoped reports) | openapi report descriptions, rbac.json scoped_assigned_clients |
| DN-LANG-01 (en fallback) | MultilingualString schema, openapi Accept-Language, DB JSONB pattern |
| EC-ORD-05 (optimistic locking dual-approval) | openapi approve versionLock required, DB orders.version_lock column |
| EC-ORD-01 (stock check at approval not submission) | openapi /approve has stock check; /submit does not |
| EC-ORD-03 (agent cannot edit submitted order) | openapi PUT /orders → ORDER_NOT_EDITABLE on non-Draft |
| FS-ORD-01 (INSUFFICIENT_STOCK detail) | InsufficientStockDetail schema, 422 on /approve |
| FS-ORD-03 (audit atomicity) | ARCH §12, DB schema audit schema isolation |
| Order state machine (all transitions) | openapi status enum CHECK, DB CHECK, events.json |
| audit.audit_log immutability | DB schema no updated_at, RBAC §6 grant policy, /audit/logs/clear |
| Public routes list | openapi security: [], RBAC §7, rbac.json public access |
| v2 hooks isolation | DB sync_status/delivery_id nullable, events.json v2_hooks |
| events.json event_type strings match DB §6 | All 16 event_type strings verified |
| managerOverride absent from API response | Not in OrderLineItem schema; audit-only per PRD §3.2 — correct |
| costPrice stripped for client | ProductVariant.costPrice has nullable + description note |
| Price fields absent from POST /orders body | Only variantId + qty accepted — confirmed |
| groupDiscount raw value hidden from client | OrderLineItem.groupDiscount description notes stripping |
