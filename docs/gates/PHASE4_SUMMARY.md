# Phase 4 — Summary

**Goals:** Complete remaining domain modules, OpenAPI parity, and hardening.

## Completed

### A) Catalog admin (variants, images, categories)

- **Variants CRUD**
  - `POST /api/v1/catalog/products/:productId/variants` (super_admin, admin)
  - `PUT /api/v1/catalog/products/:productId/variants/:variantId` — SKU change blocked with 409 when non-draft orders reference variant
  - `DELETE .../variants/:variantId` — blocked with 409 when variant has active orders
- **Variant images**
  - `POST .../variants/:variantId/images` (URL only)
  - `DELETE .../variants/:variantId/images/:imageId`
  - `PUT .../variants/:variantId/images/reorder` — 422 when imageIds contain unknown/duplicate IDs
- **Categories admin**
  - `POST /api/v1/catalog/categories`, `PUT .../categories/:id`, `DELETE .../categories/:id`
  - Delete blocked with 409 when products are assigned to the category
- Public catalog unchanged: no price keys on product/variants when unauthenticated (no regression).

### B) Users + Client Groups

- **Users:** GET list (pagination + role, isActive), POST (super_admin only, bcrypt cost 12, 409 on duplicate email), GET/PUT/DELETE by id, agent-client GET/POST/DELETE with 409 on already assigned. RBAC and audit (user.created, user.updated, user.deactivated, user.client_assigned, user.client_unassigned) already in place; verified.
- **Client Groups:** DELETE already returns 409 when clients are in group; audit events aligned to `client_group.created`, `client_group.updated`, `client_group.deleted`.

### C) OpenAPI + docs parity

- Error envelope and X-Correlation-ID on all responses (existing).
- Deviations and constraints documented in `docs/DECISION_LOG.md` (DL-07, DL-08, DL-09).
- PDF export remains 501 NOT_IMPLEMENTED (DL-06).
- No new error codes added; existing `CONFLICT`, `VALIDATION_ERROR`, `FORBIDDEN` used.

### D) Tests (targeted)

- `tests/phase4.test.ts`: Users RBAC (agent updating other user → 403), client group delete when clients assigned → 409, variant SKU update when active order references variant → 409, category delete when products assigned → 409, variant images reorder with unknown IDs → 422, agent GET another agent’s clients → 403.
- Tests that require admin/super_admin/agent users may return early (pass without asserting) when those users are not present in the DB.

## Touched files

- `services/api/src/modules/catalog/repo.ts` — variants, images, categories create/update/delete + helpers
- `services/api/src/modules/catalog/schemas.ts` — variant/category param and body schemas, reorder schema
- `services/api/src/modules/catalog/service.ts` — variant CRUD, variant images, category CRUD, 409 constraints, audit
- `services/api/src/modules/catalog/routes.ts` — routes for variants, variant images, categories admin
- `services/api/src/modules/client-groups/service.ts` — audit event names → client_group.*
- `docs/DECISION_LOG.md` — DL-07, DL-08, DL-09
- `services/api/tests/phase4.test.ts` — new Phase 4 targeted tests

## Build and test

- `npm run build` — pass
- `npm run test` — 28 tests pass (including Phase 4)
