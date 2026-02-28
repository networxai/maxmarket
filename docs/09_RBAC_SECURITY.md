# 09_RBAC_SECURITY.md
## MaxMarket — RBAC & Security Reference
**Version:** 1.0

---

## 1. Role Definitions

| Role | Code | Description |
|---|---|---|
| Super Admin | `super_admin` | Full system access; user/role management; audit clearing |
| Admin | `admin` | Full business data access; version editing; pricing/stock admin |
| Manager | `manager` | Order approval; price override; fulfillment |
| Agent | `agent` | Order creation for assigned clients; scoped visibility |
| Client | `client` | Catalog browse + own order history; read-only |

---

## 2. Permission Matrix

### 2.1 User Management

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| List all users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit any user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit own profile (name/lang) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Assign/change role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Deactivate user | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign client to agent | ✅ | ✅ | ❌ | ❌ | ❌ |
| View assigned clients | ✅ | ✅ | ✅ | own only | ❌ |

### 2.2 Catalog & Products

| Action | super_admin | admin | manager | agent | client | public |
|---|---|---|---|---|---|---|
| Browse catalog (no price) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View client pricing | ✅ | ✅ | ✅ | ✅ | own group | ❌ |
| View cost price | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create product | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit product | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete product (soft) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage categories | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.3 Inventory

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| View stock levels | ✅ | ✅ | ✅ | ✅ | ❌ |
| Adjust stock (available_qty) | ✅ | ✅ | ❌ | ❌ | ❌ |

### 2.4 Orders

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| View all orders | ✅ | ✅ | ✅ | own only | own only |
| Create Draft order | ❌ | ❌ | ❌ | ✅ (assigned clients) | ❌ |
| Edit Draft order | ❌ | ❌ | ❌ | ✅ (own drafts) | ❌ |
| Delete Draft order | ❌ | ❌ | ❌ | ✅ (own drafts) | ❌ |
| Submit order | ❌ | ❌ | ❌ | ✅ | ❌ |
| Approve order | ❌ | ❌ | ✅ | ❌ | ❌ |
| Reject order | ❌ | ❌ | ✅ | ❌ | ❌ |
| Override line item price | ❌ | ❌ | ✅ (on Submitted) | ❌ | ❌ |
| Mark Fulfilled | ❌ | ❌ | ✅ | ❌ | ❌ |
| Cancel Approved order | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark Returned | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Approved (version) | ✅ | ✅ | ❌ | ❌ | ❌ |
| View order versions | ✅ | ✅ | ✅ | ❌ | ❌ |

### 2.5 Pricing Rules

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| View pricing rules (client groups) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Modify group discount rules | ✅ | ✅ | ❌ | ❌ | ❌ |
| Modify base price (variant) | ✅ | ✅ | ❌ | ❌ | ❌ |

> **Note (FIX-S2):** Manager can **view** client group discount rules (`GET /client-groups`).
> This is required so managers have pricing context when approving orders and applying
> line-item price overrides. Managers cannot **modify** pricing rules.
> Source: `contracts/rbac.json` `client_groups.list: manager: true`;
> `contracts/openapi.yaml` GET /client-groups role description.

### 2.6 Reports

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| Sales by date | ✅ | ✅ | ✅ | scoped | ❌ |
| Sales by manager | ✅ | ✅ | ✅ | ❌ | ❌ |
| Sales by client | ✅ | ✅ | ✅ | scoped | ❌ |
| Sales by product | ✅ | ✅ | ✅ | scoped | ❌ |
| Export (CSV/PDF) | ✅ | ✅ | ✅ | scoped | ❌ |

*scoped = filtered to Agent's assigned clients only*

### 2.7 Audit & System

| Action | super_admin | admin | manager | agent | client |
|---|---|---|---|---|---|
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ |
| Clear audit log (soft) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage UI translations | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage system config | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 3. RBAC Implementation

### 3.1 Middleware Stack

```typescript
// Applied on every protected route
router.use(correlationIdMiddleware);  // inject/forward X-Correlation-ID
router.use(authMiddleware);           // verify JWT, attach req.user
router.use(rbacMiddleware(permission)); // check role against permission map
```

### 3.2 Auth Middleware

```typescript
// src/shared/middleware/auth.ts
export function authMiddleware(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json(formatError('TOKEN_MISSING'));
  
  try {
    const payload = verifyJWT(token);  // throws if expired or invalid
    req.user = { id: payload.userId, role: payload.role, clientGroupId: payload.clientGroupId };
    next();
  } catch (e) {
    return res.status(401).json(formatError('TOKEN_EXPIRED'));
  }
}
```

### 3.3 RBAC Middleware

```typescript
// src/shared/middleware/rbac.ts
export function requireRoles(...roles: Role[]) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json(formatError('FORBIDDEN'));
    }
    next();
  };
}

// Example usage:
router.post('/orders/:id/approve',
  requireRoles('manager'),
  orderController.approve
);
```

### 3.4 Resource Ownership Checks (beyond role)

Some resources require ownership validation in the service layer, not just role:

| Check | Where Enforced |
|---|---|
| Agent can only view/edit own orders | `orders.service.ts` |
| Agent can only create orders for assigned clients | `orders.service.ts` |
| Agent report scoped to assigned clients | `reports.service.ts` |
| Client can only view own orders | `orders.service.ts` |
| Client cannot see other clients' pricing | `catalog.service.ts` |

---

## 4. JWT Token Specification

### Access Token Payload

```json
{
  "sub": "uuid",
  "userId": "uuid",
  "role": "agent",
  "clientGroupId": "uuid | null",
  "iat": 1700000000,
  "exp": 1700000900
}
```

### Refresh Token

- Stored as opaque UUID in `refresh_tokens` table
- Hashed (SHA-256) before storage
- On use: old record's `used_at` set, new token issued
- Replay detection: if `used_at` is already set → invalidate ALL tokens for user

---

## 5. Security Controls

### 5.1 Rate Limiting

| Endpoint Group | Limit | Window |
|---|---|---|
| `POST /auth/login` | 10 requests | 15 min per IP |
| `POST /auth/refresh` | 30 requests | 15 min per user |
| All other endpoints | 200 requests | 1 min per user |

Implementation: in-memory (e.g., `express-rate-limit`) for v1; Redis-backed for v2 if needed.

### 5.2 Input Validation

- Zod schemas defined in each module's `*.validation.ts`
- Applied before route handler: `validateBody(schema)` middleware
- On failure: returns `VALIDATION_ERROR (422 Unprocessable Entity)` with Zod error details
  *(HTTP 422 is the correct semantic for well-formed JSON that fails schema validation;
  HTTP 400 is reserved for unparseable/malformed request bodies.)*

### 5.3 Correlation ID

```typescript
// Every request gets a correlation_id
export function correlationIdMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
```

### 5.4 Structured Logging

Every log entry includes:
```json
{
  "timestamp": "ISO8601",
  "level": "info|warn|error",
  "correlationId": "uuid",
  "userId": "uuid | null",
  "method": "POST",
  "path": "/api/v1/orders/123/approve",
  "statusCode": 200,
  "durationMs": 45,
  "message": "string"
}
```

### 5.5 Password Security

- Bcrypt with cost factor ≥ 12
- No password stored in plain text anywhere
- Password reset flow: secure token via email (implementation TBD; not in v1 scope explicitly)

### 5.6 Data Visibility Enforcement

Enforcement is **server-side only**. Frontend visibility is cosmetic. All API responses strip fields based on role:

| Field | Stripped for |
|---|---|
| `costPrice` | client, public |
| `stockLevels` | client, public |
| `managerOverride` | all (audit only) |
| `agentId` | client |
| `groupDiscount` raw value | client (client sees only final price) |

---

## 6. Audit Security

- `audit.audit_log` table has no `UPDATE` or `DELETE` grants for the application DB user
- Only `INSERT` and `SELECT` granted on `audit.audit_log` to app role
- Soft-delete (`cleared_at`) is set via a dedicated function/stored procedure with its own permissions
- Super Admin "clear" action: calls stored procedure that first INSERTs the clearing event, then UPDATEs `cleared_at` on the batch — ensuring the clear event is never itself clearable (it has no `cleared_at` set)

---

## 7. Public Routes (No Auth Required)

```
GET  /api/v1/catalog/products
GET  /api/v1/catalog/products/:id
GET  /api/v1/catalog/categories
GET  /api/v1/i18n/ui-strings
POST /api/v1/auth/login
POST /api/v1/auth/refresh
```

All other routes require a valid JWT access token.
