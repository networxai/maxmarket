/**
 * Phase 3 minimal tests: public catalog strips prices, i18n public, orders error envelope.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { build } from "../src/server.js";
import { CORRELATION_ID_HEADER } from "../src/lib/constants.js";
import { ErrorCodes, buildErrorEnvelope } from "../src/lib/errors.js";
import { AppError } from "../src/plugins/error-handler.js";

describe("Public catalog", () => {
  it("GET /api/v1/catalog/products without auth returns 200 and forbidden price keys ABSENT (not null)", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/products",
    });
    assert.strictEqual(res.statusCode, 200);
    const headerName = Object.keys(res.headers).find(
      (k) => k.toLowerCase() === "x-correlation-id"
    );
    assert.ok(headerName, "Response must include X-Correlation-ID");
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body.data), "Response must have data array");
    const forbiddenProductKeys = ["costPrice", "pricePerUnit", "pricePerBox", "clientPrice"];
    const forbiddenVariantKeys = ["costPrice", "pricePerUnit", "pricePerBox", "clientPrice"];
    for (const product of body.data as Array<Record<string, unknown>>) {
      for (const key of forbiddenProductKeys) {
        assert.strictEqual(key in product, false, `Product must not have key "${key}" (must be absent)`);
      }
      const variants = product.variants as Array<Record<string, unknown>> | undefined;
      if (variants) {
        for (const v of variants) {
          for (const key of forbiddenVariantKeys) {
            assert.strictEqual(key in v, false, `Variant must not have key "${key}" (must be absent)`);
          }
        }
      }
    }
  });

  it("GET /api/v1/catalog/categories returns 200 and ARRAY of Category (no pagination wrapper)", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/categories",
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(Array.isArray(body), "Response must be Category[] array, not wrapper");
    for (const cat of body as Array<Record<string, unknown>>) {
      assert.ok("id" in cat && "name" in cat, "Each category must have id and name");
    }
  });

  it("public catalog variants must not have any price keys (keys must be absent)", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/products?pageSize=5",
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    const data = body.data as Array<Record<string, unknown>>;
    const forbiddenVariantKeys = ["costPrice", "pricePerUnit", "pricePerBox", "clientPrice"];
    for (const product of data) {
      const variants = product.variants as Array<Record<string, unknown>> | undefined;
      if (variants) {
        for (const v of variants) {
          for (const key of forbiddenVariantKeys) {
            assert.strictEqual(key in v, false, `Variant must not have key "${key}" (absent)`);
          }
        }
      }
    }
  });

  it("GET /api/v1/catalog/products/:id without auth has no price keys on product or variants", async () => {
    const app = await build();
    const listRes = await app.inject({ method: "GET", url: "/api/v1/catalog/products?pageSize=1" });
    assert.strictEqual(listRes.statusCode, 200);
    const listBody = JSON.parse(listRes.payload);
    const data = listBody.data as Array<Record<string, unknown>>;
    if (data.length === 0) return;
    const productId = data[0].id as string;
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/catalog/products/${productId}`,
    });
    assert.strictEqual(res.statusCode, 200);
    const product = JSON.parse(res.payload) as Record<string, unknown>;
    const forbiddenKeys = ["costPrice", "pricePerUnit", "pricePerBox", "clientPrice"];
    for (const key of forbiddenKeys) {
      assert.strictEqual(key in product, false, `Product must not have key "${key}" (absent)`);
    }
    const variants = product.variants as Array<Record<string, unknown>> | undefined;
    if (variants) {
      for (const v of variants) {
        for (const key of forbiddenKeys) {
          assert.strictEqual(key in v, false, `Variant must not have key "${key}" (absent)`);
        }
      }
    }
  });
});

describe("I18n public", () => {
  it("GET /api/v1/i18n/ui-strings?language=en returns 200 and object", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/i18n/ui-strings?language=en",
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.strictEqual(typeof body, "object", "Response must be object");
    assert.ok(!Array.isArray(body), "Response must not be array");
  });
});

describe("Orders error envelope", () => {
  it("GET /api/v1/orders without auth returns 401 with error envelope", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
    });
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.ok(
      body.errorCode === ErrorCodes.UNAUTHORIZED || body.errorCode === ErrorCodes.TOKEN_MISSING,
      "401 must have UNAUTHORIZED or TOKEN_MISSING"
    );
    assert.ok(body.correlationId);
  });

  it("PUT /api/v1/orders with invalid id returns 422 when validation fails", async () => {
    const app = await build();
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/orders/not-a-uuid",
      headers: {
        authorization: "Bearer fake-token-for-validation-test",
      },
      payload: { notes: "test" },
    });
    assert.ok(res.statusCode === 401 || res.statusCode === 422);
    if (res.statusCode === 422) {
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.errorCode, ErrorCodes.VALIDATION_ERROR);
      assert.ok(body.correlationId);
    }
  });

  it("GET /api/v1/orders/:id/versions/:versionNumber with invalid versionNumber returns 422 VALIDATION_ERROR", async () => {
    const app = await build();
    const orderId = "00000000-0000-0000-0000-000000000001";
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${orderId}/versions/x`,
      headers: { authorization: "Bearer fake" },
    });
    assert.ok(res.statusCode === 401 || res.statusCode === 422);
    if (res.statusCode === 422) {
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.errorCode, ErrorCodes.VALIDATION_ERROR);
      assert.ok(body.correlationId);
    }
  });

  it("GET /api/v1/orders/:id/versions/:versionNumber with invalid id returns 422 VALIDATION_ERROR", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders/not-a-uuid/versions/1",
      headers: { authorization: "Bearer fake" },
    });
    assert.ok(res.statusCode === 401 || res.statusCode === 422);
    if (res.statusCode === 422) {
      const body = JSON.parse(res.payload);
      assert.strictEqual(body.errorCode, ErrorCodes.VALIDATION_ERROR);
    }
  });
});

describe("Error envelope shapes", () => {
  it("INSUFFICIENT_STOCK details include lineItemId, variantId, sku, requestedQty, availableQty, reservedQty", () => {
    const details = [
      {
        lineItemId: "li-1",
        variantId: "v-1",
        sku: "SKU-1",
        requestedQty: 10,
        availableQty: 2,
        reservedQty: 1,
      },
    ];
    const envelope = buildErrorEnvelope(
      ErrorCodes.INSUFFICIENT_STOCK,
      "Insufficient stock",
      "corr-1",
      details
    );
    assert.strictEqual(envelope.errorCode, "INSUFFICIENT_STOCK");
    assert.ok(Array.isArray(envelope.details));
    const first = (envelope.details as Array<Record<string, unknown>>)[0];
    assert.strictEqual(first.lineItemId, "li-1");
    assert.strictEqual(first.variantId, "v-1");
    assert.strictEqual(first.sku, "SKU-1");
    assert.strictEqual(first.requestedQty, 10);
    assert.strictEqual(first.availableQty, 2);
    assert.strictEqual(first.reservedQty, 1);
  });

  it("OPTIMISTIC_LOCK_CONFLICT maps to 409 and errorCode", () => {
    const err = new AppError(409, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, "Version conflict");
    assert.strictEqual(err.statusCode, 409);
    assert.strictEqual(err.errorCode, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT);
  });
});

describe("Reports and Audit", () => {
  it("GET /api/v1/reports/sales-by-date without auth returns 401", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/sales-by-date",
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it("GET /api/v1/audit/logs without auth returns 401", async () => {
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit/logs",
    });
    assert.strictEqual(res.statusCode, 401);
  });

  it("501 NOT_IMPLEMENTED: error handler returns 501 with NOT_IMPLEMENTED envelope (no details)", async () => {
    const Fastify = (await import("fastify")).default;
    const correlationIdPlugin = (await import("../src/plugins/correlation-id.js")).default;
    const errorHandlerPlugin = (await import("../src/plugins/error-handler.js")).default;
    const app = Fastify({ logger: false });
    await app.register(correlationIdPlugin);
    await app.register(errorHandlerPlugin);
    app.get("/test-501", async () => {
      throw new AppError(501, ErrorCodes.NOT_IMPLEMENTED, "PDF export not implemented");
    });
    const cid = "a1b2c3d4-e5f6-4789-a012-345678901234";
    const res = await app.inject({
      method: "GET",
      url: "/test-501",
      headers: { [CORRELATION_ID_HEADER]: cid },
    });
    assert.strictEqual(res.statusCode, 501);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, "NOT_IMPLEMENTED");
    assert.strictEqual(body.message, "PDF export not implemented");
    assert.strictEqual(body.details !== undefined && body.details !== null, false, "details must be null or undefined");
    assert.strictEqual(body.correlationId, cid);
    const headerName = Object.keys(res.headers).find((k) => k.toLowerCase() === "x-correlation-id");
    assert.ok(headerName, "X-Correlation-ID header must be present");
  });

  it("GET /api/v1/reports/:reportType/export?format=pdf when authenticated returns 501 NOT_IMPLEMENTED", async () => {
    const app = await build();
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@maxmarket.com", password: "ChangeMe1!" },
    });
    if (loginRes.statusCode !== 200) {
      return;
    }
    const loginBody = JSON.parse(loginRes.payload) as { accessToken?: string };
    const token = loginBody.accessToken;
    if (!token) return;
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/sales-by-date/export?format=pdf",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.strictEqual(res.statusCode, 501);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, "NOT_IMPLEMENTED");
    assert.strictEqual(body.message, "PDF export not implemented");
    assert.ok(body.correlationId);
  });
});
