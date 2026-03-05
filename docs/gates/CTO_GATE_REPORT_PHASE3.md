# CTO Gate Check Audit — Phase 3 (Pre–Phase 4)

**Date:** Pre–Phase 4 gate  
**Scope:** 501 NOT_IMPLEMENTED mapping, public catalog forbidden keys absent, approve transaction semantics.

---

## Task 1 — 501 NOT_IMPLEMENTED mapping

### Findings
- **A)** Error handler: `src/plugins/error-handler.ts` handles `AppError` first and passes `error.statusCode` and `error.errorCode` through; `buildErrorEnvelope` in `src/lib/errors.ts` only adds `details` when not null/undefined.
- **B)** Throwing `AppError(501, ErrorCodes.NOT_IMPLEMENTED, "PDF export not implemented")` already produced HTTP 501, `body.errorCode === "NOT_IMPLEMENTED"`, correct message, no details, and correlationId from the AppError path.
- **C)** The **fallback** branch (non-AppError with `statusCode >= 400`) mapped 401/403/404/409 to specific codes and **everything else to INTERNAL_ERROR**. So a non-AppError with status 501 would have been mapped to INTERNAL_ERROR and wrong code.

### Changes required
- **Yes.** Explicit handling for status **501 → NOT_IMPLEMENTED** in the fallback branch so any 501 response keeps `errorCode: "NOT_IMPLEMENTED"`.

### Files changed
- `src/plugins/error-handler.ts` — added `fastifyErr.statusCode === 501 ? ErrorCodes.NOT_IMPLEMENTED` in the fallback mapping.

### Tests
- **501 NOT_IMPLEMENTED:** New test that a route throwing `AppError(501, NOT_IMPLEMENTED, "PDF export not implemented")` returns status 501, `errorCode` NOT_IMPLEMENTED, message, no details, and X-Correlation-ID (minimal app with correlation-id + error-handler).
- **Export PDF when authenticated:** Test that `GET /api/v1/reports/sales-by-date/export?format=pdf` with valid token (after login) returns 501 and NOT_IMPLEMENTED envelope (runs only when seed admin exists).

---

## Task 2 — Public catalog forbidden keys absent

### Findings
- **A)** Public endpoints: `GET /api/v1/catalog/products`, `GET /api/v1/catalog/products/:id`, `GET /api/v1/catalog/categories` (categories have no price fields).
- **B)** Public paths use `toPublicProduct` / `toPublicVariant`; only allowed fields are set (id, name, description, category, variants, isActive for product; id, sku, unitType, minOrderQty, isActive, images for variant). No costPrice, pricePerUnit, pricePerBox, clientPrice anywhere in those DTOs.
- **C)** No serializers or DB mappers add those fields on the public path; repo returns full rows but service maps through `toPublicProduct`/`toPublicVariant` only.
- **D)** Tests previously used `product.costPrice === undefined` and `"costPrice" in v ? v.costPrice : "absent"`; requirement is keys **absent** (not present), so `key in obj === false` is the right check.

### Changes required
- **No code change.** Public responses already omit forbidden keys.
- **Tests:** Strengthened to assert **keys are absent** with `assert.strictEqual(key in product, false)` (and same for variant) for all four forbidden keys on both product and variants. Added test for **GET /api/v1/catalog/products/:id** without auth: product and each variant must not have costPrice, pricePerUnit, pricePerBox, clientPrice.

### Files changed
- `tests/phase3.test.ts` — public catalog tests now assert `key in product` / `key in v` is false; added GET /products/:id public test.

---

## Task 3 — Approve transaction semantics (available_qty vs reserved_qty)

### Findings
- **A)** Schema and docs: `available_qty` = “current physically available stock” (glossary); “decremented only upon Fulfillment”; “must always be ≥ reserved_qty”. Fulfill decrements both reserved_qty and available_qty. So **available_qty = on-hand total**, **reserved_qty = committed**; free stock = **available_qty - reserved_qty**.
- **B)** Raw SQL in `approveOrderInTransaction` was: `WHERE ... AND available_qty >= ${li.qty}`. That allows over-reservation when reserved_qty > 0 (e.g. available=10, reserved=8, order_qty=5 would incorrectly pass).
- **C)** Correct condition: **(available_qty - reserved_qty) >= qty** (free stock ≥ requested).

### Changes required
- **Yes.** UPDATE WHERE clause changed from `available_qty >= ${li.qty}` to **(available_qty - reserved_qty) >= ${li.qty}**.
- **D)** INSUFFICIENT_STOCK details already include lineItemId, variantId, sku, requestedQty, availableQty, reservedQty (unchanged).
- **E)** Repo comment added documenting semantics and example (available=10, reserved=8, order_qty=5 → fail). No new integration test added (would require DB seed for warehouse_stock + order in submitted state); existing INSUFFICIENT_STOCK envelope test already validates details shape.

### Files changed
- `src/modules/orders/repo.ts` — WHERE clause now `(available_qty - reserved_qty) >= ${li.qty}`; JSDoc comment added for approve semantics.

---

## Summary

| Task | Changes required | Files changed |
|------|------------------|----------------|
| 1 — 501 mapping | Yes (fallback 501 → NOT_IMPLEMENTED) | error-handler.ts |
| 2 — Public catalog keys | No (tests only) | phase3.test.ts |
| 3 — Approve semantics | Yes (SQL + comment) | orders/repo.ts |

All tests pass. X-Correlation-ID remains set by the existing correlation-id plugin on every response. Error envelope shape unchanged: `{ errorCode, message, details?, correlationId }`.

---

## Commands

```bash
cd services/api
npm run build
npm run test
```
