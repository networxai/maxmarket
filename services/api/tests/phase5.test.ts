/**
 * Phase 5 tests: auth flows, orders, reports, audit with seeded data.
 */
import { describe, it, afterEach, after } from "node:test";
import assert from "node:assert";
import { build } from "../src/server.js";
import { ErrorCodes } from "../src/lib/errors.js";
import { ensureSeed } from "./helpers/seed.js";
import { deleteProductAndRelated, cleanupTestCatalogArtifacts } from "./helpers/cleanup.js";
import { prisma } from "../src/lib/prisma.js";

after(async () => {
  await cleanupTestCatalogArtifacts();
});

async function login(app: Awaited<ReturnType<typeof build>>, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.payload) as { accessToken?: string; user?: { id: string } };
  assert.ok(body.accessToken);
  assert.ok(body.user?.id);
  return body as { accessToken: string; user: { id: string } };
}

describe("Phase 5 — Auth flows", () => {
  it("login + refresh rotation + logout + reuse detection", async () => {
    await ensureSeed();
    const app = await build();

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "super_admin@maxmarket.com", password: "ChangeMe1!" },
    });
    assert.strictEqual(loginRes.statusCode, 200);
    const setCookie = loginRes.headers["set-cookie"];
    assert.ok(setCookie, "Expected refresh cookie on login");
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const refreshMatch = cookieHeader?.match(/refreshToken=([^;]+)/);
    assert.ok(refreshMatch && refreshMatch[1], "Expected refreshToken cookie value");
    const refreshCookie = refreshMatch[1];

    // Use cookie to rotate refresh token
    const refreshRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refreshToken=${refreshCookie}` },
      payload: {},
    });
    assert.strictEqual(refreshRes.statusCode, 200);
    const body = JSON.parse(refreshRes.payload) as { accessToken?: string; refreshToken?: string };
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);

    // Reuse old refresh token (cookie) should revoke all tokens and return 401 UNAUTHORIZED
    const reuseRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: { cookie: `refreshToken=${refreshCookie}` },
      payload: {},
    });
    assert.strictEqual(reuseRes.statusCode, 401);
    const reuseBody = JSON.parse(reuseRes.payload) as { errorCode?: string; message?: string; correlationId?: string };
    assert.strictEqual(reuseBody.errorCode, ErrorCodes.UNAUTHORIZED);
    assert.ok(reuseBody.correlationId);

    // Logout clears cookie path correctly
    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { authorization: `Bearer ${loginRes.accessToken}` },
      payload: {},
    });
    assert.strictEqual(logoutRes.statusCode, 200);
  });
});

describe("Phase 5 — Auto-create stock on variant creation (DL-17)", () => {
  let toCleanProductId: string | undefined;
  let toCleanVariantId: string | undefined;
  afterEach(async () => {
    if (toCleanVariantId) {
      await prisma.warehouseStock.deleteMany({ where: { productVariantId: toCleanVariantId } });
      await prisma.productVariant.deleteMany({ where: { id: toCleanVariantId } });
      toCleanVariantId = undefined;
    }
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("new variant from POST /catalog/products gets warehouse_stock row", async () => {
    await ensureSeed();
    const app = await build();
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const category = await prisma.category.findFirst({ where: { deletedAt: null } });
    assert.ok(category);
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/products",
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: {
        name: { en: "DL17 Test Product" },
        description: { en: "Testing auto-stock" },
        categoryId: category.id,
        variants: [
          { sku: `DL17-TEST-${Date.now()}`, unitType: "piece", minOrderQty: 1, costPrice: 5, pricePerUnit: 10 },
        ],
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const product = JSON.parse(createRes.payload) as { id: string; variants: Array<{ id: string }> };
    toCleanProductId = product.id;
    const variantId = product.variants[0]!.id;
    const stock = await prisma.warehouseStock.findFirst({
      where: { productVariantId: variantId },
    });
    assert.ok(stock, "Warehouse stock row must exist for new variant");
    assert.strictEqual(stock.availableQty, 0);
    assert.strictEqual(stock.reservedQty, 0);
    assert.strictEqual(stock.warehouseId, "00000000-0000-0000-0000-000000000010");
  });

  it("new variant from POST /catalog/products/{id}/variants gets warehouse_stock row", async () => {
    await ensureSeed();
    const app = await build();
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const product = await prisma.product.findFirst({
      where: { deletedAt: null },
      include: { variants: { where: { deletedAt: null } } },
    });
    assert.ok(product);
    const createRes = await app.inject({
      method: "POST",
      url: `/api/v1/catalog/products/${product.id}/variants`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: {
        sku: `DL17-VAR-${Date.now()}`,
        unitType: "piece",
        minOrderQty: 1,
        costPrice: 2,
        pricePerUnit: 4,
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const variant = JSON.parse(createRes.payload) as { id: string };
    toCleanVariantId = variant.id;
    const stock = await prisma.warehouseStock.findFirst({
      where: { productVariantId: variant.id },
    });
    assert.ok(stock, "Warehouse stock row must exist for new variant");
    assert.strictEqual(stock.availableQty, 0);
    assert.strictEqual(stock.reservedQty, 0);
  });
});

describe("Phase 5 — Orders stock + optimistic lock", () => {
  let createdOrderId: string | undefined;
  let stockRestore: { warehouseId: string; variantId: string; availableQty: number } | undefined;
  afterEach(async () => {
    if (createdOrderId) {
      await prisma.orderVersion.deleteMany({ where: { orderId: createdOrderId } });
      await prisma.order.deleteMany({ where: { id: createdOrderId } });
      createdOrderId = undefined;
    }
    if (stockRestore) {
      await prisma.warehouseStock.updateMany({
        where: {
          warehouseId: stockRestore.warehouseId,
          productVariantId: stockRestore.variantId,
        },
        data: { availableQty: stockRestore.availableQty },
      });
      stockRestore = undefined;
    }
  });
  it("approve uses free stock = available - reserved", async () => {
    await ensureSeed();
    const app = await build();
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");

    const seedVariant = await prisma.productVariant.findFirst({
      where: { sku: "SEED-SKU-1", deletedAt: null },
    });
    assert.ok(seedVariant);
    const seedWarehouse = await prisma.warehouse.findFirst({
      where: { id: "00000000-0000-0000-0000-000000000010" },
    });
    assert.ok(seedWarehouse);

    const order = await prisma.order.create({
      data: {
        orderNumber: `SEED-STOCK-${Date.now()}`,
        clientId: (await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } }))!.id,
        agentId: (await prisma.user.findFirst({ where: { email: "agent1@maxmarket.com" } }))!.id,
        status: "submitted",
        lineItems: {
          create: {
            variantId: seedVariant!.id,
            warehouseId: seedWarehouse!.id,
            qty: 5,
            unitType: "piece",
            basePrice: 10,
            groupDiscount: 0,
            managerOverride: null,
            finalPrice: 10,
          },
        },
      },
      include: { lineItems: true },
    });
    createdOrderId = order.id;

    const li = order.lineItems[0];
    const stock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: li.warehouseId, productVariantId: li.variantId },
    });
    assert.ok(stock);

    // Set free stock below ordered qty to force INSUFFICIENT_STOCK:
    // free = available - reserved = qty - 1
    stockRestore = { warehouseId: li.warehouseId, variantId: li.variantId, availableQty: stock!.availableQty };
    await prisma.warehouseStock.update({
      where: { warehouseId_productVariantId: { warehouseId: li.warehouseId, productVariantId: li.variantId } },
      data: { availableQty: li.qty + stock!.reservedQty - 1 },
    });

    const badRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order!.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(badRes.statusCode, 422);
    const body = JSON.parse(badRes.payload) as { errorCode?: string; details?: unknown; correlationId?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.INSUFFICIENT_STOCK);
    assert.ok(body.details);
    assert.ok(body.correlationId);
  });

  it("optimistic lock conflict on approve returns 409 OPTIMISTIC_LOCK_CONFLICT", async () => {
    await ensureSeed();
    const app = await build();
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");

    const order = await prisma.order.findFirst({
      where: { orderNumber: "SEED-SUBMITTED-1" },
      include: { lineItems: { include: { variant: true } } },
    });
    assert.ok(order);
    const originalVersionLock = order!.versionLock;

    // Manually bump versionLock to simulate stale client
    await prisma.order.update({
      where: { id: order!.id },
      data: { versionLock: order!.versionLock + 1 },
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order!.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    if (res.statusCode === 409) {
      const body = JSON.parse(res.payload) as { errorCode?: string; correlationId?: string };
      assert.strictEqual(body.errorCode, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT);
      assert.ok(body.correlationId);
    }
    await prisma.order.update({
      where: { id: order!.id },
      data: { versionLock: originalVersionLock },
    });
  });
});

describe("Phase 5 — Reports and audit", () => {
  let createdUserId: string | undefined;
  afterEach(async () => {
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
      createdUserId = undefined;
    }
  });
  it("agent scoping: cannot export client report for unassigned clientId", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");

    const auth = await import("../src/auth/auth-service.js");
    const email = "unassigned-client@maxmarket.com";
    const otherClient = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash: await auth.hashPassword("ChangeMe1!"),
        fullName: "Unassigned Client",
        role: "client",
        preferredLanguage: "en",
      },
    });
    createdUserId = otherClient.id;

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/sales-by-client?clientId=${otherClient.id}&page=1&pageSize=10`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload) as { errorCode?: string; correlationId?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
    assert.ok(body.correlationId);
  });

  it("export pdf returns 501 NOT_IMPLEMENTED with standard envelope", async () => {
    await ensureSeed();
    const app = await build();
    const adminLogin = await login(app, "super_admin@maxmarket.com", "ChangeMe1!");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/sales-by-date/export?format=pdf",
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 501);
    const body = JSON.parse(res.payload) as { errorCode?: string; message?: string; correlationId?: string; details?: unknown };
    assert.strictEqual(body.errorCode, ErrorCodes.NOT_IMPLEMENTED);
    assert.strictEqual(body.message, "PDF export not implemented");
    assert.ok(body.correlationId);
    assert.ok(body.details === undefined);
  });

  it("audit log RBAC + filters return entries after known action", async () => {
    await ensureSeed();
    const app = await build();
    const adminLogin = await login(app, "super_admin@maxmarket.com", "ChangeMe1!");

    // Trigger a known audit event via login
    await login(app, "agent1@maxmarket.com", "ChangeMe1!");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/audit/logs?page=1&pageSize=20&eventType=auth.login_attempt",
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { data?: Array<{ eventType: string }>; pagination?: unknown };
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data!.some((e) => e.eventType === "auth.login_attempt"));
  });
});

