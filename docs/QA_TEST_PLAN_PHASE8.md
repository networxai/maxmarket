# QA Test Plan — MaxMarket Phase 8

**QA Lead:** Claude Agent  
**Date:** 2026-02-24  
**API Base:** `http://localhost:3000/api/v1`  
**Seed Password:** `ChangeMe1!`

---

## Overview

This plan covers automated E2E API testing for MaxMarket Phase 8. All tests run externally against the live API as HTTP clients. Tests verify order lifecycle, RBAC enforcement, stock mechanics, pricing rules, and edge cases.

### Test Users

| Email | Role | Notes |
|-------|------|-------|
| `super_admin@maxmarket.com` | super_admin | Full access |
| `admin1@maxmarket.com` | admin | Full business access |
| `manager1@maxmarket.com` | manager | Approvals, overrides |
| `agent1@maxmarket.com` | agent | Assigned to client1, client2 |
| `agent2@maxmarket.com` | agent | Assigned to client3 |
| `client1@maxmarket.com` | client | "Default Clients" group |
| `client2@maxmarket.com` | client | "Premium Clients" group |
| `client3@maxmarket.com` | client | Assigned to agent2 |

### Test Files

| File | Scenario |
|------|----------|
| `tests/qa/helpers.ts` | Shared utilities (login, API calls, assertions) |
| `tests/qa/s01-order-lifecycle.ts` | S1: Full order lifecycle happy path |
| `tests/qa/s02-insufficient-stock.ts` | S2: Insufficient stock on approve |
| `tests/qa/s03-price-override.ts` | S3: Manager price override |
| `tests/qa/s04-version-edit.ts` | S4: Admin version edit |
| `tests/qa/s05-optimistic-lock.ts` | S5: Optimistic lock conflict |
| `tests/qa/s06-agent-scoping.ts` | S6: Agent assignment scoping |
| `tests/qa/s07-client-readonly.ts` | S7: Client read-only enforcement |
| `tests/qa/s08-return-stock.ts` | S8: Return does not restore stock |
| `tests/qa/s09-cancel-stock.ts` | S9: Cancel releases reserved stock |
| `tests/qa/s10-draft-delete.ts` | S10: Draft delete rules |
| `tests/qa/rbac-matrix.ts` | QA8.3: Full RBAC matrix |
| `tests/qa/edge-cases.ts` | QA8.4: Edge case validation |
| `tests/qa/regression-phase7.ts` | QA8.5: Phase 7 regression |

---

## S1: Full Order Lifecycle (Happy Path)

**File:** `tests/qa/s01-order-lifecycle.ts`  
**Roles:** agent1, manager1  
**Preconditions:** Seed data loaded, at least one product with stock available.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login as agent1 | 200, accessToken returned |
| 2 | GET /users/{agent1.id}/clients | 200, list includes client1 |
| 3 | GET /catalog/products (as agent1) | 200, products with variants and prices |
| 4 | POST /orders — create draft for client1, qty=5 | 201, status="draft", orderNumber matches `MM-\d{4}-\d{6}`, groupDiscount=0, finalPrice=basePrice |
| 5 | PUT /orders/{id} — change qty to 10 | 200, lineItems[0].qty=10 |
| 6 | POST /orders/{id}/submit | 200, status="submitted", groupDiscount recalculated, finalPrice=basePrice-groupDiscount |
| 7 | GET /inventory/stock?variantId={id} | 200, record availableQty and reservedQty |
| 8 | Login as manager1, POST /orders/{id}/approve | 200, status="approved" |
| 9 | GET /inventory/stock — check after approve | reservedQty = previous + order qty |
| 10 | POST /orders/{id}/fulfill | 200, status="fulfilled" |
| 11 | GET /inventory/stock — check after fulfill | availableQty = previous - order qty, reservedQty back to pre-approve level |

---

## S2: Insufficient Stock

**File:** `tests/qa/s02-insufficient-stock.ts`  
**Roles:** admin1, agent1, manager1  
**Preconditions:** Seed data loaded.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Admin adjusts stock to tight level (availableQty=8) | 200 |
| 2 | GET /inventory/stock — record available, reserved, compute free | free = available - reserved |
| 3 | Agent1 creates order with qty > free, submits | 201 (draft), 200 (submit) |
| 4 | Manager1 approves | 422, errorCode="INSUFFICIENT_STOCK", details array with lineItemId/variantId/sku/requestedQty/availableQty/reservedQty |
| 5 | GET /orders/{id} — verify status still "submitted" | status="submitted" |
| 6 | Admin restores stock to safe level | 200 |

---

## S3: Manager Price Override

**File:** `tests/qa/s03-price-override.ts`  
**Roles:** agent1, manager1, client1  
**Preconditions:** Seed data loaded.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Agent1 creates and submits order | 201, 200 |
| 2 | Note lineItem finalPrice | Recorded |
| 3 | Manager1: POST /orders/{id}/line-items/{lineItemId}/override-price {overridePrice: 99.99} | 200, finalPrice=99.99 |
| 4 | GET /orders/{id} as manager | lineItem finalPrice=99.99 |
| 5 | Manager1 approves order | 200 |
| 6 | Client1: GET /orders/{id} | finalPrice=99.99, no groupDiscount/managerOverride/basePrice visible, no agentId |

---

## S4: Admin Version Edit

**File:** `tests/qa/s04-version-edit.ts`  
**Roles:** agent1, manager1, admin1  
**Preconditions:** Seed data loaded, sufficient stock.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create → submit → approve an order | status="approved" |
| 2 | Record currentVersion and versionLock | Noted |
| 3 | Admin1: PUT /orders/{id} with changed lineItems and versionLock | 200, status="submitted", currentVersion=previous+1 |
| 4 | Manager1 approves new version | 200 (or 422 INSUFFICIENT_STOCK — valid) |
| 5 | GET /orders/{id}/versions | 200, array with ≥2 entries |
| 6 | GET /orders/{id}/versions/1 | 200, has snapshot and diff fields |

---

## S5: Optimistic Lock Conflict

**File:** `tests/qa/s05-optimistic-lock.ts`  
**Roles:** agent1, manager1  
**Preconditions:** Seed data loaded.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create and submit an order | status="submitted" |
| 2 | Manager1 notes versionLock, approves with correct lock | 200 |
| 3 | Create another submitted order, note versionLock=V | status="submitted" |
| 4 | Manager1 approves with versionLock=V | 200 (lock now V+1) |
| 5 | Manager1 tries approve again with stale versionLock=V | 409, errorCode="OPTIMISTIC_LOCK_CONFLICT" |

---

## S6: Agent Scoping

**File:** `tests/qa/s06-agent-scoping.ts`  
**Roles:** agent1, agent2, admin1  
**Preconditions:** Seed data with agent-client assignments.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Agent1 creates order for client1 (assigned) | 201 |
| 2 | Agent1 creates order for client3 (agent2's client) | 403 |
| 3 | Agent2 creates draft for client3 | 201 |
| 4 | Agent1: GET /orders/{agent2's order} | 403 |
| 5 | Agent1: GET /orders | None have agentId ≠ agent1.id |

---

## S7: Client Read-Only

**File:** `tests/qa/s07-client-readonly.ts`  
**Roles:** client1  
**Preconditions:** At least one order exists for client1.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Client1: GET /orders | 200, all orders have clientId=client1.id |
| 2 | Client1: GET /orders/{id} | No agentId, no groupDiscount on lineItems, has finalPrice |
| 3 | Client1: POST /orders | 403 |
| 4 | Client1: POST /orders/{id}/approve | 403 |
| 5 | Client1: POST /orders/{id}/reject | 403 |
| 6 | Client1: PUT /orders/{id} | 403 |
| 7 | Client1: DELETE /orders/{id} | 403 |
| 8 | Client1: POST /orders/{id}/submit | 403 |
| 9 | Client1: POST /orders/{id}/fulfill | 403 |
| 10 | Client1: POST /orders/{id}/cancel | 403 |
| 11 | Client1: POST /orders/{id}/return | 403 |

---

## S8: Return Does Not Restore Stock

**File:** `tests/qa/s08-return-stock.ts`  
**Roles:** agent1, manager1  
**Preconditions:** A fulfilled order exists (or created in test).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Get/create a fulfilled order | status="fulfilled" |
| 2 | Record stock for each variant in the order | availableQty, reservedQty noted |
| 3 | Manager1: POST /orders/{id}/return | 200, status="returned" |
| 4 | Check stock for each variant | availableQty and reservedQty identical to step 2 |

---

## S9: Cancel Releases Reserved Stock

**File:** `tests/qa/s09-cancel-stock.ts`  
**Roles:** agent1, manager1  
**Preconditions:** Seed data loaded with sufficient stock.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create → submit → approve an order | status="approved", stock reserved |
| 2 | Record stock: note reservedQty for each variant | Recorded |
| 3 | Manager1: POST /orders/{id}/cancel | 200, status="cancelled" |
| 4 | Check stock | reservedQty decreased by order line quantities, availableQty unchanged |

---

## S10: Draft Delete

**File:** `tests/qa/s10-draft-delete.ts`  
**Roles:** agent1, agent2  
**Preconditions:** Seed data loaded.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Agent1 creates draft → DELETE /orders/{id} | 200 |
| 2 | GET /orders/{id} | 404 |
| 3 | Agent1 creates order → submits → DELETE /orders/{id} | 422 |
| 4 | Agent1 creates draft → Agent2: DELETE /orders/{id} | 403 |

---

## QA8.3: RBAC Matrix

**File:** `tests/qa/rbac-matrix.ts`  
**Roles:** All 5 seeded roles (super_admin, admin, manager, agent, client)  
**Preconditions:** Seed data loaded, test orders in various states.

Tests every order endpoint as every role, asserting allowed roles get 2xx and forbidden roles get 403. Endpoints tested:

- POST /orders (create draft)
- GET /orders (list)
- GET /orders/{id} (detail)
- PUT /orders/{id} (edit)
- DELETE /orders/{id} (delete draft)
- POST /orders/{id}/submit
- POST /orders/{id}/approve
- POST /orders/{id}/reject
- POST /orders/{id}/fulfill
- POST /orders/{id}/cancel
- POST /orders/{id}/return
- POST /orders/{id}/line-items/{lineItemId}/override-price
- GET /orders/{id}/versions
- GET /orders/{id}/versions/{version}

---

## QA8.4: Edge Cases

**File:** `tests/qa/edge-cases.ts`  
**Roles:** agent1, manager1  
**Preconditions:** Seed data loaded.

| Test | Request | Expected |
|------|---------|----------|
| Empty lineItems | POST /orders with lineItems: [] | 422 |
| Qty = 0 | POST /orders with qty: 0 | 422 |
| Submit non-draft | POST submit on submitted order | 422 |
| Approve non-submitted | POST approve on draft | 422 |
| Fulfill non-approved | POST fulfill on submitted | 422 |
| Cancel non-approved | POST cancel on submitted | 422 |
| Return non-fulfilled | POST return on approved | 422 |
| Edit rejected order | PUT on rejected order | 422, errorCode=ORDER_NOT_EDITABLE |
| Version edit no lock | PUT approved order without versionLock | 422 or 400 |
| Non-existent order | GET /orders/{random-uuid} | 404 |

---

## QA8.5: Phase 7 Regression

**File:** `tests/qa/regression-phase7.ts`  
**Roles:** unauthenticated, agent1, client1  
**Preconditions:** Seed data loaded, catalog populated.

| Test | Request | Expected |
|------|---------|----------|
| Public catalog | GET /catalog/products (no auth) | 200, products present, NO price keys |
| Agent catalog | GET /catalog/products (agent1) | 200, price keys present |
| Client catalog | GET /catalog/products (client1) | 200, has clientPrice, no costPrice |
| Categories | GET /catalog/categories (no auth) | 200 |
| Bad login | POST /auth/login wrong password | 401 |
| Good login | POST /auth/login correct password | 200, has accessToken and user |

---

## Execution Order

1. Read project files (openapi.yaml, CTO_PACKET, rbac.json, DECISION_LOG)
2. Write test plan (this document)
3. Write helpers.ts and S1 lifecycle test
4. Execute S1
5. Write and execute S6, S7 (security-critical)
6. Write and execute S2, S3, S4, S5
7. Write and execute S8, S9, S10
8. Write and execute RBAC matrix
9. Write and execute edge cases
10. Write and execute regression
11. Compile QA_RESULTS_PHASE8.md

---

## Bug Reporting Format

```
BUG-XXX: <title>
- Endpoint: <method> <path>
- Role: <role>
- Request Body: <JSON>
- Expected: <status/response>
- Actual: <status/response>
- Correlation ID: <id>
```
