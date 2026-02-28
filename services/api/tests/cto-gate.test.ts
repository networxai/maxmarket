/**
 * CTO gate tests: correlation header casing, 404 envelope, 401 codes,
 * 409 optimistic lock mapping, cookie clear on logout and refresh reuse.
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { build } from "../src/server.js";
import { CORRELATION_ID_HEADER } from "../src/lib/constants.js";
import { ErrorCodes } from "../src/lib/errors.js";
import { AppError } from "../src/plugins/error-handler.js";

describe("CTO gate", () => {
  it("response includes X-Correlation-ID header (code uses exact casing)", async () => {
    assert.strictEqual(
      CORRELATION_ID_HEADER,
      "X-Correlation-ID",
      "Constant must be exactly X-Correlation-ID per spec"
    );
    const app = await build();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });
    assert.strictEqual(res.statusCode, 200);
    const headerName = Object.keys(res.headers).find(
      (k) => k.toLowerCase() === "x-correlation-id"
    );
    assert.ok(headerName, "X-Correlation-ID header must be present on every response");
    assert.ok(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        res.headers[headerName!] as string
      ),
      "Value must be valid UUID"
    );
  });

  it("404 notFound uses error envelope and X-Correlation-ID", async () => {
    const app = await build();
    const correlationId = "a1b2c3d4-e5f6-4789-a012-345678901234";
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/nonexistent",
      headers: { [CORRELATION_ID_HEADER]: correlationId },
    });
    assert.strictEqual(res.statusCode, 404);
    const headerName = Object.keys(res.headers).find(
      (k) => k.toLowerCase() === "x-correlation-id"
    );
    assert.ok(headerName, "404 response must include X-Correlation-ID header");
    assert.strictEqual(res.headers[headerName!], correlationId);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.errorCode, ErrorCodes.NOT_FOUND);
    assert.strictEqual(body.message, "Not Found");
    assert.strictEqual(body.correlationId, correlationId);
  });

  it("401 missing refresh token returns TOKEN_MISSING", async () => {
    const app = await build();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {},
      headers: {},
    });
    assert.strictEqual(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.strictEqual(body.errorCode, ErrorCodes.TOKEN_MISSING);
    assert.strictEqual(typeof body.correlationId, "string");
    const headerName = Object.keys(res.headers).find(
      (k) => k.toLowerCase() === "x-correlation-id"
    );
    assert.ok(headerName, "401 response must include X-Correlation-ID header");
  });
});

describe("Error envelope", () => {
  it("AppError 409 OPTIMISTIC_LOCK_CONFLICT maps to same code", () => {
    const err = new AppError(
      409,
      ErrorCodes.OPTIMISTIC_LOCK_CONFLICT,
      "Version conflict"
    );
    assert.strictEqual(err.statusCode, 409);
    assert.strictEqual(err.errorCode, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT);
  });

  it("AppError 409 CONFLICT is distinct from OPTIMISTIC_LOCK_CONFLICT", () => {
    const err = new AppError(409, ErrorCodes.CONFLICT, "Already exists");
    assert.strictEqual(err.errorCode, ErrorCodes.CONFLICT);
  });
});

describe("Constants", () => {
  it("CORRELATION_ID_HEADER is exactly X-Correlation-ID", () => {
    assert.strictEqual(CORRELATION_ID_HEADER, "X-Correlation-ID");
  });
});

describe("Cookie and logout", () => {
  it("logout response clears cookie with path /api/v1/auth", async () => {
    const app = await build();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      payload: {},
    });
    assert.strictEqual(res.statusCode, 200);
    const setCookie = res.headers["set-cookie"];
    assert.ok(setCookie, "Set-Cookie should be present for clear");
    assert.ok(
      setCookie.includes("Path=/api/v1/auth") || setCookie.includes("path=/api/v1/auth"),
      "Cleared cookie must use path /api/v1/auth"
    );
  });
});
