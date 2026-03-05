# 07_API_SPEC.md
## MaxMarket — API Specification
**Version:** 1.0  
**Base URL:** `/api/v1`  
**Format:** JSON (camelCase request/response)  
**Auth:** Bearer JWT (except public catalog endpoints)

---

## Global Conventions

### Request Headers

| Header | Required | Description |
|---|---|---|
| `Authorization` | On protected routes | `Bearer <access_token>` |
| `X-Correlation-ID` | Optional (generated if absent) | UUID for request tracing |
| `Accept-Language` | Optional | `en`, `hy`, `ru` (default: `en`) |
| `Content-Type` | POST/PUT/PATCH | `application/json` |

### Response Headers

| Header | Always Present |
|---|---|
| `X-Correlation-ID` | Yes — echoed or generated |

### Standard Error Response

```json
{
  "errorCode": "string",
  "message": "string",
  "details": "any | null",
  "correlationId": "uuid"
}
```

### Pagination (all list endpoints)

Query params: `?page=1&pageSize=20` (pageSize max 100)  
Response wrapper:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 1500,
    "totalPages": 75
  }
}
```

---

## Module: Auth

### POST /auth/login

**Access:** Public  
**Body:**
```json
{ "email": "string", "password": "string" }
```
**Response 200:**
```json
{
  "accessToken": "string",
  "refreshToken": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "role": "super_admin | admin | manager | agent | client",
    "fullName": "string",
    "preferredLanguage": "en | hy | ru"
  }
}
```
**Errors:** `INVALID_CREDENTIALS (401)`, `ACCOUNT_INACTIVE (403)`, `RATE_LIMITED (429)`  
**Audit:** Login attempt (success/fail, IP, user)

---

### POST /auth/refresh

**Access:** Public (requires valid refresh token)  
**Body:**
```json
{ "refreshToken": "string" }
```
**Response 200:**
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```
**Errors:** `INVALID_REFRESH_TOKEN (401)`, `REFRESH_TOKEN_EXPIRED (401)`  
**Note:** Old refresh token invalidated on use. Replay of used token invalidates all user tokens.

---

### POST /auth/logout

**Access:** Authenticated  
**Body:**
```json
{ "refreshToken": "string" }
```
**Response 200:** `{ "success": true }`

---

## Module: Users

### GET /users

**Access:** Super Admin, Admin  
**Query:** `?page&pageSize&role&isActive`  
**Response 200:** Paginated list of users

---

### POST /users

**Access:** Super Admin  
**Body:**
```json
{
  "email": "string",
  "password": "string",
  "fullName": "string",
  "role": "admin | manager | agent | client",
  "preferredLanguage": "en | hy | ru",
  "clientGroupId": "uuid | null"
}
```
**Response 201:** Created user object (no password)  
**Audit:** User created (actor, new user ID, role)

---

### GET /users/:id

**Access:** Super Admin, Admin; Agent (own profile only); Client (own profile only)  
**Response 200:** User object

---

### PUT /users/:id

**Access:** Super Admin (any); users (own profile: name + language only)  
**Body:** Partial user fields  
**Audit:** Role change if role modified

---

### DELETE /users/:id (soft deactivate)

**Access:** Super Admin  
**Response 200:** `{ "success": true }`  
**Note:** Sets `isActive = false`, not physical delete

---

### GET /users/:agentId/clients

**Access:** Super Admin, Admin, Manager; Agent (own assignments only)  
**Response 200:** Paginated clients assigned to agent

---

### POST /users/:agentId/clients/:clientId

**Access:** Super Admin, Admin  
**Response 200:** Assignment created  
**Note:** Assigns client to agent

---

### DELETE /users/:agentId/clients/:clientId

**Access:** Super Admin, Admin  
**Response 200:** Assignment removed

---

## Module: Client Groups

### GET /client-groups

**Access:** Admin, Manager, Agent, Super Admin  
**Response 200:** List of client groups with discount rules

---

### POST /client-groups

**Access:** Admin, Super Admin  
**Body:**
```json
{
  "name": "string",
  "discountType": "fixed | percentage",
  "discountValue": "number"
}
```
**Response 201:** Created group

---

### PUT /client-groups/:id

**Access:** Admin, Super Admin  
**Body:** Partial group fields  
**Note:** Discount change triggers price recalculation for all Draft orders linked to clients in this group upon their next submission (DN-PRICE-02)

---

### DELETE /client-groups/:id

**Access:** Admin, Super Admin  
**Note:** Blocked if clients are assigned to this group

---

## Module: Catalog

### GET /catalog/products (PUBLIC)

**Access:** Public (no auth) + Authenticated  
**Query:** `?page&pageSize&category&search&language`  
- `search` matches against SKU or product name (indexed)
- `category` filter by category ID  
**Response 200:** Paginated products  
- Unauthenticated: no price fields  
- Client: `clientPrice` only  
- Agent/Manager/Admin: `clientPrice` + `costPrice`

**Product item shape (authenticated client):**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "category": { "id": "uuid", "name": "string" },
  "variants": [
    {
      "id": "uuid",
      "sku": "string",
      "unitType": "piece | box | kg",
      "minOrderQty": 1,
      "pricePerUnit": 100.00,
      "pricePerBox": null,
      "clientPrice": 90.00,
      "images": ["url"]
    }
  ]
}
```

---

### GET /catalog/products/:id (PUBLIC)

**Access:** Public + Authenticated  
**Response 200:** Single product with variants  
**Note:** Same pricing visibility rules as list

---

### POST /catalog/products

**Access:** Admin, Super Admin  
**Body:**
```json
{
  "name": { "en": "string", "hy": "string", "ru": "string" },
  "description": { "en": "string", "hy": "string", "ru": "string" },
  "categoryId": "uuid",
  "variants": [
    {
      "sku": "string",
      "unitType": "piece | box | kg",
      "minOrderQty": 1,
      "costPrice": 80.00,
      "pricePerUnit": 100.00,
      "pricePerBox": null,
      "images": ["url"]
    }
  ]
}
```
**Response 201:** Created product  
**Note:** Missing language fields are accepted; fallback to `en` on read (DN-LANG-01)

---

### PUT /catalog/products/:id

**Access:** Admin, Super Admin  
**Body:** Partial product fields (including variants)

---

### DELETE /catalog/products/:id

**Access:** Admin, Super Admin  
**Note:** Soft delete; products with pending/approved orders cannot be deleted (returns `PRODUCT_HAS_ACTIVE_ORDERS`)

---

### GET /catalog/categories

**Access:** Public  
**Response 200:** Category list with multilingual names

---

### POST /catalog/categories

**Access:** Admin, Super Admin  
**Body:**
```json
{ "name": { "en": "string", "hy": "string", "ru": "string" } }
```

---

## Module: Inventory

### GET /inventory/stock

**Access:** Admin, Manager, Agent, Super Admin  
**Query:** `?warehouseId&variantId&page&pageSize`  
**Response 200:** Paginated warehouse_stock records
```json
{
  "variantId": "uuid",
  "sku": "string",
  "warehouseId": "uuid",
  "availableQty": 100,
  "reservedQty": 20
}
```

---

### PUT /inventory/stock/adjust

**Access:** Admin, Super Admin  
**Body:**
```json
{
  "warehouseId": "uuid",
  "variantId": "uuid",
  "newAvailableQty": 150,
  "reason": "string"
}
```
**Response 200:** Updated stock record  
**Errors:** `STOCK_BELOW_RESERVED (422)` — if `newAvailableQty < reservedQty`  
**Audit:** Stock adjustment (variant, warehouse, old qty, new qty, actor, reason)  
**Note:** Audit write and stock write are atomic (FS-ORD-03)

---

## Module: Orders

### GET /orders

**Access:** Admin, Manager, Super Admin: all orders; Agent: own orders only  
**Query:** `?page&pageSize&status&clientId&agentId&dateFrom&dateTo`  
**Response 200:** Paginated orders

---

### POST /orders

**Access:** Agent only  
**Body:**
```json
{
  "clientId": "uuid",
  "lineItems": [
    {
      "variantId": "uuid",
      "qty": 10,
      "warehouseId": "uuid"
    }
  ],
  "notes": "string | null"
}
```
**Response 201:** Created Draft order  
**Note:** Agent can only create for assigned clients  
**Note:** Prices computed from group discount at creation time

---

### GET /orders/:id

**Access:** Admin, Manager, Super Admin: any; Agent: own orders; Client: own orders  
**Response 200:** Full order with line items and version info

---

### PUT /orders/:id

**Access:** Agent (Draft only); Admin (Approved only — creates new version)  
**Body:** Updated line items / notes  
**Rules:**
- Agent: blocked if status ≠ Draft (EC-ORD-03 → `ORDER_NOT_EDITABLE`)
- Admin edit of Approved: creates new version, resets status to Submitted, triggers re-approval  
**Audit:** Draft edit or version creation

---

### DELETE /orders/:id

**Access:** Agent (Draft only)  
**Response 200:** Order soft-deleted  
**Note:** Only Draft orders can be deleted

---

### POST /orders/:id/submit

**Access:** Agent  
**Response 200:** Order transitions to Submitted  
**Rules:**
- Re-calculates prices from current group discount (DN-PRICE-02)
- Validates all line items have qty ≥ minOrderQty  
**Errors:** `ORDER_NOT_DRAFT (422)`, `PRICE_RECALCULATION_FAILED (500)`

---

### POST /orders/:id/approve

**Access:** Manager  
**Response 200:** Order transitions to Approved; stock reserved  
**Rules:**
- Checks `available_qty ≥ order_qty` for every line item (FS-ORD-01)
- Optimistic lock: uses `versionLock` to prevent dual-approval (EC-ORD-05)  
**Errors:** `ORDER_NOT_SUBMITTED (422)`, `INSUFFICIENT_STOCK (422)`, `OPTIMISTIC_LOCK_CONFLICT (409)`  
**Audit:** Approval event

---

### POST /orders/:id/reject

**Access:** Manager  
**Body:**
```json
{ "reason": "string | null" }
```
**Response 200:** Order transitions to Rejected  
**Audit:** Rejection event with optional reason (DN-ORD-01)

---

### POST /orders/:id/fulfill

**Access:** Manager  
**Response 200:** Order transitions to Fulfilled; stock decremented  
**Rules:** Atomic stock update (reserved − qty, available − qty)

---

### POST /orders/:id/cancel

**Access:** Manager, Admin (DN-ORD-02)  
**Response 200:** Order transitions to Cancelled; reserved stock released  
**Note:** Only Approved orders can be cancelled

---

### POST /orders/:id/return

**Access:** Manager, Admin  
**Response 200:** Order transitions to Returned; available_qty restored (DN-STK-01)  
**Note:** Only Fulfilled orders can be returned

---

### GET /orders/:id/versions

**Access:** Admin, Super Admin, Manager  
**Response 200:** List of all versions for this order

---

### GET /orders/:id/versions/:versionNumber

**Access:** Admin, Super Admin, Manager  
**Response 200:** Immutable version snapshot with audit diff

---

## Module: Pricing (Manager Override)

### POST /orders/:orderId/line-items/:lineItemId/override-price

**Access:** Manager  
**Body:**
```json
{ "overridePrice": 85.00 }
```
**Response 200:** Updated line item  
**Rules:** Only allowed when order status = Submitted  
**Audit:** Price override (order, line item, manager, original price, override price, timestamp)

---

## Module: Reports

### GET /reports/sales-by-date

**Access:** Admin, Manager, Super Admin; Agent (scoped to assigned clients — DN-RPT-01)  
**Query:** `?dateFrom&dateTo&page&pageSize`  
**Response 200:** Paginated sales data

---

### GET /reports/sales-by-manager

**Access:** Admin, Manager, Super Admin  
**Query:** `?managerId&dateFrom&dateTo&page&pageSize`

---

### GET /reports/sales-by-client

**Access:** Admin, Manager, Super Admin; Agent (own clients only)  
**Query:** `?clientId&dateFrom&dateTo&page&pageSize`

---

### GET /reports/sales-by-product

**Access:** Admin, Manager, Super Admin; Agent (own clients only)  
**Query:** `?variantId&dateFrom&dateTo&page&pageSize`

---

### GET /reports/:reportType/export

**Access:** Same as report read  
**Query:** `?format=csv|pdf&dateFrom&dateTo&[...same filters]`  
**Response:** File stream with appropriate Content-Type  
**Note:** Export applies active filters; no pagination on export (full result set)

---

## Module: Audit

### GET /audit/logs

**Access:** Super Admin, Admin  
**Query:** `?page&pageSize&eventType&userId&dateFrom&dateTo&includeCleared=false`  
**Response 200:** Paginated audit log entries

---

### POST /audit/logs/clear

**Access:** Super Admin only  
**Body:**
```json
{ "scope": "before_date", "beforeDate": "ISO8601" }
```
**Response 200:** `{ "clearedCount": 1500 }`  
**Rules:**
- Writes clearing event to audit BEFORE soft-deleting
- Sets `cleared_at` on matching records  
**Audit:** Log clearing event (actor, scope, timestamp, count)

---

## Module: I18n

### GET /i18n/ui-strings

**Access:** Public  
**Query:** `?language=en|hy|ru`  
**Response 200:** Key-value map of UI translation strings

---

### PUT /i18n/ui-strings

**Access:** Super Admin only  
**Body:**
```json
{
  "language": "hy",
  "strings": {
    "nav.products": "Ապրանքներ",
    "btn.submit": "Ներկայացնել"
  }
}
```
**Response 200:** Updated strings

---

## Error Code Reference

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `TOKEN_EXPIRED` | 401 | JWT expired |
| `INVALID_REFRESH_TOKEN` | 401 | Bad/used refresh token |
| `FORBIDDEN` | 403 | Role does not have permission |
| `NOT_FOUND` | 404 | Resource not found |
| `ORDER_NOT_DRAFT` | 422 | Action requires Draft status |
| `ORDER_NOT_SUBMITTED` | 422 | Action requires Submitted status |
| `ORDER_NOT_APPROVED` | 422 | Action requires Approved status |
| `ORDER_NOT_EDITABLE` | 422 | Agent attempt to edit non-Draft |
| `ORDER_INVALID_TRANSITION` | 422 | Invalid state machine transition |
| `INSUFFICIENT_STOCK` | 422 | Approval blocked by stock |
| `STOCK_BELOW_RESERVED` | 422 | Adjustment would go below reserved |
| `OPTIMISTIC_LOCK_CONFLICT` | 409 | Concurrent modification detected |
| `PRODUCT_HAS_ACTIVE_ORDERS` | 409 | Cannot delete product with active orders |
| `VALIDATION_ERROR` | 400 | Zod validation failure |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
