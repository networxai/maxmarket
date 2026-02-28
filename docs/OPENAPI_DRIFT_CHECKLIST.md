## OpenAPI Drift Checklist (Phase 5)

Before each release:

1. **Validate OpenAPI syntax**
   - Run: `npm run openapi:lint`.
   - Ensure `contracts/openapi.yaml` parses and contains `openapi` + `paths`.

2. **New routes audit**
   - For each new Fastify route under `/api/v1`, confirm:
     - There is a corresponding `paths[...]` entry in `contracts/openapi.yaml`, **or**
     - The deviation is documented in `docs/DECISION_LOG.md` (with ID and rationale).

3. **Error responses**
   - Spot-check a sample of new/changed endpoints:
     - 4xx/5xx responses reference `#/components/schemas/ErrorResponse`.
     - `X-Correlation-ID` header component is present on all responses.

4. **Security & RBAC**
   - Ensure any route requiring auth under `/api/v1` has `security` defined in OpenAPI, and that role-specific rules are captured in the description.

5. **Business constraints**
   - For any new 409 / 422 paths (business rules, validation), confirm:
     - 409/422 are listed in OpenAPI responses.
     - The business rule is described in the endpoint description and, if non-trivial, in `docs/DECISION_LOG.md`.

6. **Public catalog**
   - Confirm public catalog schemas (`PublicProduct`, `PublicProductVariant`) still exclude price keys, and that public endpoints use them.

If any of the above checks fail, fix code or OpenAPI **before** merging to main.

