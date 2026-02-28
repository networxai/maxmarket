# QA Results — MaxMarket Phase 8

**QA Lead:** Claude Agent  
**Execution Date:** 2026-02-27  
**API Base:** `http://localhost:3000/api/v1`  
**Status:** ✅ ALL TESTS PASSING

---

## Execution Summary

| Scenario | File | Result | Passed | Failed |
|----------|------|--------|--------|--------|
| S1: Full Order Lifecycle | s01-order-lifecycle.ts | ✅ PASS | 21 | 0 |
| S2: Insufficient Stock | s02-insufficient-stock.ts | ✅ PASS | 15 | 0 |
| S3: Manager Price Override | s03-price-override.ts | ✅ PASS | 13 | 0 |
| S4: Admin Version Edit | s04-version-edit.ts | ✅ PASS | 9 | 0 |
| S5: Optimistic Lock Conflict | s05-optimistic-lock.ts | ✅ PASS | 7 | 0 |
| S6: Agent Scoping | s06-agent-scoping.ts | ✅ PASS | 7 | 0 |
| S7: Client Read-Only | s07-client-readonly.ts | ✅ PASS | 15 | 0 |
| S8: Return Does Not Restore Stock | s08-return-stock.ts | ✅ PASS | 5 | 0 |
| S9: Cancel Releases Reserved Stock | s09-cancel-stock.ts | ✅ PASS | 5 | 0 |
| S10: Draft Delete | s10-draft-delete.ts | ✅ PASS | 8 | 0 |
| QA8.3: RBAC Matrix | rbac-matrix.ts | ✅ PASS | 50 | 0 |
| QA8.4: Edge Cases | edge-cases.ts | ✅ PASS | 11 | 0 |
| QA8.5: Phase 7 Regression | regression-phase7.ts | ✅ PASS | 16 | 0 |
| **TOTAL** | | | **182** | **0** |

---

## Detailed Results

### S1: Full Order Lifecycle
**Result:** ✅ PASS — 21 passed, 0 failed  
**Bugs:** None  
**Notes:** Full create → edit → submit → approve → fulfill cycle verified. Stock correctly reserved on approve, decremented on fulfill. Order number format `MM-YYYY-NNNNNN` confirmed. Pricing recalculation on submit confirmed (groupDiscount applied, finalPrice = basePrice - groupDiscount).

### S2: Insufficient Stock
**Result:** ✅ PASS — 15 passed, 0 failed  
**Bugs:** None  
**Notes:** Confirmed stock is NOT checked at draft creation or submission — only at approve time. INSUFFICIENT_STOCK error returns detailed `details` array with lineItemId, variantId, sku, requestedQty, availableQty, reservedQty. Order remains "submitted" after failed approve.

### S3: Manager Price Override
**Result:** ✅ PASS — 13 passed, 0 failed  
**Bugs:** None  
**Notes:** Override field is `managerOverride` (not `overridePrice`). Price persists through approve. Client view correctly hides groupDiscount, managerOverride, basePrice, and agentId.

### S4: Admin Version Edit
**Result:** ✅ PASS — 9 passed, 0 failed  
**Bugs:** None  
**Notes:** Admin edit on approved order creates new version, resets status to "submitted", increments currentVersion. Version history stores 1 entry per edit (snapshot of pre-edit state). `diff` field is present but null in current implementation.

### S5: Optimistic Lock Conflict
**Result:** ✅ PASS — 7 passed, 0 failed  
**Bugs:** None  
**Notes:** Tested via approve → admin version edit (succeeds) → re-approve → stale lock edit (409 OPTIMISTIC_LOCK_CONFLICT). Lock correctly increments on each state change.

### S6: Agent Scoping
**Result:** ✅ PASS — 7 passed, 0 failed  
**Bugs:** None  
**Notes:** Agent1 cannot create orders for agent2's clients (403). Agent1 cannot view agent2's orders (403). Agent1's order list only contains their own orders.

### S7: Client Read-Only
**Result:** ✅ PASS — 15 passed, 0 failed  
**Bugs:** None  
**Notes:** All 9 mutation endpoints return 403 for client role. Client order list only contains their own orders. Sensitive fields (agentId, groupDiscount) correctly hidden.

### S8: Return Does Not Restore Stock
**Result:** ✅ PASS — 5 passed, 0 failed  
**Bugs:** None  
**Notes:** Per CTO-DEC-001 / DL-10, return does NOT auto-restore stock. Both availableQty and reservedQty unchanged after return.

### S9: Cancel Releases Reserved Stock
**Result:** ✅ PASS — 5 passed, 0 failed  
**Bugs:** None  
**Notes:** Cancel correctly decreases reservedQty by order line quantities. availableQty unchanged (stock was only reserved, not fulfilled).

### S10: Draft Delete
**Result:** ✅ PASS — 8 passed, 0 failed  
**Bugs:** None  
**Notes:** DELETE returns 204 (standard REST). Deleted order returns 404 (soft delete). Cannot delete submitted orders (422). Cannot delete another agent's draft (403).

### QA8.3: RBAC Matrix
**Result:** ✅ PASS — 50 passed, 0 failed  
**Bugs:** None  
**Notes:** Tested 10 endpoints × 5 roles = 50 checks. Key findings:
- Only agent can create/submit/delete drafts
- Only manager can approve/reject
- Manager, admin, and super_admin can fulfill/cancel/return
- Only manager can override price
- All roles can list and view orders (scoped to their permissions)

### QA8.4: Edge Cases
**Result:** ✅ PASS — 11 passed, 0 failed  
**Bugs:** None  
**Notes:** All state machine transitions validated (cannot skip states). Empty lineItems and qty=0 rejected at validation. Missing versionLock on approved order edit returns 409. Non-existent order returns 404. Rejected order edit returns ORDER_NOT_EDITABLE.

### QA8.5: Phase 7 Regression
**Result:** ✅ PASS — 16 passed, 0 failed  
**Bugs:** None  
**Notes:** Public catalog: no price fields. Agent catalog: price fields present. Client catalog: client-facing price present, no costPrice. Auth: wrong password → 401, correct → 200 with accessToken and user.

---

## Bug Log

All bugs found during testing were reported to the CTO and fixed by the Backend Agent during the test cycle:

| Bug | Description | Status |
|-----|-------------|--------|
| BUG-001 | Login returns 500 Internal Error (DB not seeded) | ✅ Fixed |
| BUG-002 | Agent can see other agents' orders in GET /orders list | ✅ Fixed |
| BUG-003 | PUT /orders returns 422 instead of 403 for unauthorized client role | ✅ Fixed |
| BUG-004 | Client response exposes basePrice on line items | ✅ Fixed |

---

## API Contract Deviations Noted

These are not bugs but differences from the onboarding directive that the tests accommodate:

1. **warehouseId required on line items** — Not mentioned in directive but required by API validation
2. **managerOverride field name** — Directive said `overridePrice`, API uses `managerOverride`
3. **DELETE returns 204** — Directive implied 200, API returns 204 (standard REST)
4. **Prices returned as strings on drafts** — groupDiscount is `"0"` (string) on draft, numeric after submit
5. **Version history stores snapshots** — One entry per edit (pre-edit snapshot), not one per version
6. **Missing versionLock returns 409** — Could be 400/422, but 409 is reasonable (treated as null ≠ current lock)
7. **No body on state transitions** — Submit/fulfill/cancel/return fail with 400 if Content-Type: application/json is sent without a body
