/**
 * Phase 6 tests: order versioning, manager price override, draft pricing recalculation,
 * client data stripping, return flow (no stock restore), rate limiting.
 * Each test that touches warehouse_stock uses isolated variant + stock (no shared seed stock).
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

const SEED_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000010";

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

/** Create isolated variant + warehouse stock so tests do not share stock rows. Returns variant id, warehouse id, and product id (for cleanup). */
async function createIsolatedVariantAndStock(): Promise<{
  variantId: string;
  warehouseId: string;
  productId: string;
}> {
  const category = await prisma.category.findFirst({ where: { deletedAt: null } });
  assert.ok(category);
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      name: { en: "P6 Iso Product" } as unknown as object,
      description: { en: "" } as unknown as object,
      isActive: true,
    },
  });
  const sku = `P6-ISO-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku,
      unitType: "piece",
      minOrderQty: 1,
      costPrice: 1,
      pricePerUnit: 10,
      pricePerBox: null,
      isActive: true,
    },
  });
  await prisma.warehouseStock.create({
    data: {
      warehouseId: SEED_WAREHOUSE_ID,
      productVariantId: variant.id,
      availableQty: 100,
      reservedQty: 0,
    },
  });
  return { variantId: variant.id, warehouseId: SEED_WAREHOUSE_ID, productId: product.id };
}

describe("Phase 6 — Order versioning E2E", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("admin edits approved order → new version, status submitted, currentVersion and versionLock incremented", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const order = JSON.parse(approveRes.payload) as { id: string; currentVersion: number; versionLock: number };
    const prevVersion = order.currentVersion;
    const prevLock = order.versionLock;

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: { versionLock: prevLock, notes: "Phase6 version edit" },
    });
    assert.strictEqual(res.statusCode, 200);
    const updated = JSON.parse(res.payload) as { currentVersion: number; versionLock: number; status: string };
    assert.strictEqual(updated.status, "submitted");
    assert.strictEqual(updated.currentVersion, prevVersion + 1);
    assert.strictEqual(updated.versionLock, prevLock + 1);
  });

  it("version list returns correct history after admin edit", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({ method: "POST", url: `/api/v1/orders/${draft.id}/submit`, headers: { authorization: `Bearer ${agentLogin.accessToken}` } });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const order = JSON.parse(approveRes.payload) as { id: string };
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: { versionLock: 1, notes: "edit" },
    });
    assert.strictEqual(putRes.statusCode, 200);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}/versions`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const versions = JSON.parse(res.payload) as Array<{ versionNumber: number }>;
    assert.ok(Array.isArray(versions));
    assert.ok(versions.length >= 1);
    const versionNumbers = versions.map((v) => v.versionNumber).sort((a, b) => a - b);
    assert.ok(versionNumbers.includes(1));
  });

  it("version detail returns snapshot", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({ method: "POST", url: `/api/v1/orders/${draft.id}/submit`, headers: { authorization: `Bearer ${agentLogin.accessToken}` } });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const order = JSON.parse(approveRes.payload) as { id: string };
    await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: { versionLock: 1, notes: "edit" },
    });

    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}/versions`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
    });
    assert.strictEqual(listRes.statusCode, 200);
    const list = JSON.parse(listRes.payload) as Array<{ versionNumber: number }>;
    const vNum = list[0]?.versionNumber ?? 1;

    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}/versions/${vNum}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
    });
    assert.strictEqual(detailRes.statusCode, 200);
    const detail = JSON.parse(detailRes.payload) as { snapshot?: unknown; versionNumber?: number };
    assert.ok(detail.snapshot);
    assert.strictEqual(detail.versionNumber, vNum);
  });

  it("optimistic lock enforced on version edit (wrong versionLock → 409)", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({ method: "POST", url: `/api/v1/orders/${draft.id}/submit`, headers: { authorization: `Bearer ${agentLogin.accessToken}` } });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const order = JSON.parse(approveRes.payload) as { id: string; versionLock: number };

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: { versionLock: order.versionLock + 999 },
    });
    assert.strictEqual(res.statusCode, 409);
    const body = JSON.parse(res.payload) as { errorCode?: string; correlationId?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT);
    assert.ok(body.correlationId);
  });

  it("re-approval after version edit performs stock recheck", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const adminLogin = await login(app, "admin1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 5 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({ method: "POST", url: `/api/v1/orders/${draft.id}/submit`, headers: { authorization: `Bearer ${agentLogin.accessToken}` } });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const order = JSON.parse(approveRes.payload) as { id: string; versionLock: number; lineItems: Array<{ variantId: string; warehouseId: string; qty: number }> };
    const putRes = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${order.id}`,
      headers: { authorization: `Bearer ${adminLogin.accessToken}` },
      payload: { versionLock: order.versionLock, notes: "edit" },
    });
    assert.strictEqual(putRes.statusCode, 200);
    const li = order.lineItems[0];
    const stock = await prisma.warehouseStock.findFirst({
      where: { warehouseId: li.warehouseId, productVariantId: li.variantId },
    });
    assert.ok(stock);
    await prisma.warehouseStock.update({
      where: { warehouseId_productVariantId: { warehouseId: li.warehouseId, productVariantId: li.variantId } },
      data: { availableQty: li.qty + stock!.reservedQty - 1 },
    });
    const reApproveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(reApproveRes.statusCode, 422);
    const body = JSON.parse(reApproveRes.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.INSUFFICIENT_STOCK);
  });
});

describe("Phase 6 — Manager price override E2E", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("manager overrides line item price on submitted order; finalPrice updated", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    const order = JSON.parse(
      (await app.inject({
        method: "GET",
        url: `/api/v1/orders/${draft.id}`,
        headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      })).payload
    ) as { id: string; lineItems: Array<{ id: string }> };
    const lineItemId = order.lineItems[0]!.id;
    const overrideAmount = 7.5;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order.id}/line-items/${lineItemId}/override-price`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
      payload: { managerOverride: overrideAmount },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { lineItems?: Array<{ finalPrice: number }> };
    assert.ok(body.lineItems?.length);
    assert.strictEqual(body.lineItems![0]!.finalPrice, overrideAmount);
  });

  it("override only allowed for submitted orders (approved → 422)", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    const approveRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(approveRes.statusCode, 200);
    const approved = JSON.parse(approveRes.payload) as { id: string; lineItems: Array<{ id: string }> };
    const lineItemId = approved.lineItems[0]!.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${approved.id}/line-items/${lineItemId}/override-price`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
      payload: { managerOverride: 8 },
    });
    assert.strictEqual(res.statusCode, 422);
    const body = JSON.parse(res.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.ORDER_NOT_EDITABLE);
  });

  it("only manager can override (agent → 403)", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    const orderRes = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${draft.id}`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    assert.strictEqual(orderRes.statusCode, 200);
    const order = JSON.parse(orderRes.payload) as { id: string; lineItems: Array<{ id: string }> };
    const lineItemId = order.lineItems[0]!.id;

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order.id}/line-items/${lineItemId}/override-price`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { managerOverride: 8 },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
  });
});

describe("Phase 6 — Draft pricing recalculation", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("draft has groupDiscount=0 and finalPrice=basePrice; on submit recalculates from client group", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    assert.ok(variant);
    const basePrice = Number(variant.pricePerUnit);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: {
        clientId: client!.id,
        lineItems: [{ variantId, warehouseId, qty: 2 }],
      },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string; lineItems?: Array<{ groupDiscount: number; finalPrice: number; basePrice: number }> };
    assert.ok(draft.lineItems?.length);
    assert.strictEqual(Number(draft.lineItems![0]!.groupDiscount), 0);
    assert.strictEqual(Number(draft.lineItems![0]!.finalPrice), basePrice);
    assert.strictEqual(Number(draft.lineItems![0]!.basePrice), basePrice);

    const submitRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
    });
    assert.strictEqual(submitRes.statusCode, 200);
    const submitted = JSON.parse(submitRes.payload) as { lineItems?: Array<{ groupDiscount: number; finalPrice: number; basePrice: number }> };
    assert.ok(submitted.lineItems?.length);
    assert.ok(submitted.lineItems![0]!.groupDiscount > 0, "groupDiscount should be recalculated from client group");
    assert.ok(submitted.lineItems![0]!.finalPrice < basePrice, "finalPrice should be basePrice - groupDiscount");
  });
});

describe("Phase 6 — Contract alignment (DL-15)", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("POST /orders with warehouseId omitted uses default warehouse", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, qty: 1 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const order = JSON.parse(createRes.payload) as { lineItems?: Array<{ warehouseId: string }> };
    assert.ok(order.lineItems?.length);
    assert.strictEqual(order.lineItems![0]!.warehouseId, "00000000-0000-0000-0000-000000000010");
  });

  it("POST /orders/{id}/submit with Content-Type application/json and empty body returns 200", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 1 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/submit`,
      headers: {
        authorization: `Bearer ${agentLogin.accessToken}`,
        "content-type": "application/json",
        "content-length": "0",
      },
      payload: undefined,
    });
    assert.strictEqual(res.statusCode, 200);
  });
});

describe("Phase 6 — Order list scoping (BUG-002)", () => {
  it("agent listing orders only sees own orders", async () => {
    await ensureSeed();
    const app = await build();
    const agent1Login = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const agent2 = await prisma.user.findFirst({ where: { email: "agent2@maxmarket.com" } });
    assert.ok(agent2);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders?page=1&pageSize=100",
      headers: { authorization: `Bearer ${agent1Login.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { data?: Array<{ agentId?: string }> };
    assert.ok(Array.isArray(body.data));
    for (const o of body.data!) {
      assert.strictEqual(o.agentId, agent1Login.user.id, "Agent must only see own orders");
    }
    const hasAgent2Order = body.data!.some((o) => o.agentId === agent2.id);
    assert.ok(!hasAgent2Order, "Agent1 must not see agent2's orders");
  });

  it("client listing orders only sees own orders", async () => {
    await ensureSeed();
    const app = await build();
    const client1Login = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const client2 = await prisma.user.findFirst({ where: { email: "client2@maxmarket.com" } });
    assert.ok(client2);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders?page=1&pageSize=100",
      headers: { authorization: `Bearer ${client1Login.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { data?: Array<{ clientId?: string }> };
    assert.ok(Array.isArray(body.data));
    for (const o of body.data!) {
      assert.strictEqual(o.clientId, client1Login.user.id, "Client must only see own orders");
    }
    const hasClient2Order = body.data!.some((o) => o.clientId === client2.id);
    assert.ok(!hasClient2Order, "Client1 must not see client2's orders");
  });
});

describe("Phase 6 — Auth before validation (BUG-003)", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("client PUT /orders/:id with invalid body gets 403 not 422", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const draft = await prisma.order.findFirst({ where: { status: "draft" } });
    assert.ok(draft);
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${draft.id}`,
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
      payload: { lineItems: [] },
    });
    assert.strictEqual(res.statusCode, 403, "Client must get 403 before body validation");
    const body = JSON.parse(res.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
  });

  it("client PUT /orders/:id with valid body still gets 403", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const draft = await prisma.order.findFirst({ where: { status: "draft" } });
    assert.ok(draft);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${draft.id}`,
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
      payload: { lineItems: [{ variantId, warehouseId, qty: 1 }] },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
  });

  it("agent on own draft PUT /orders/:id with invalid body gets 422", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 1 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/orders/${draft.id}`,
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { lineItems: [] },
    });
    assert.strictEqual(res.statusCode, 422, "Authorized agent must get 422 for invalid body");
    const body = JSON.parse(res.payload) as { errorCode?: string };
    assert.strictEqual(body.errorCode, ErrorCodes.VALIDATION_ERROR);
  });
});

describe("Phase 6 — Client role data stripping", () => {
  it("client order response strips agentId", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const order = await prisma.order.findFirst({ where: { orderNumber: "SEED-DRAFT-1" } });
    assert.ok(order);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order!.id}`,
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { agentId?: string };
    assert.strictEqual("agentId" in body ? body.agentId : undefined, undefined);
  });

  it("client catalog response does not include costPrice", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/products?page=1&pageSize=5",
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { data?: Array<{ variants?: Array<{ costPrice?: number | null }> }> };
    const firstVariant = body.data?.[0]?.variants?.[0];
    if (firstVariant) assert.ok(firstVariant.costPrice === null || firstVariant.costPrice === undefined, "Client must not see cost price");
  });

  it("client order line items do not include groupDiscount (only finalPrice visible)", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const order = await prisma.order.findFirst({ where: { orderNumber: "SEED-SUBMITTED-1" }, include: { lineItems: true } });
    assert.ok(order);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order!.id}`,
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { lineItems?: Array<{ groupDiscount?: number; finalPrice?: number }> };
    if (body.lineItems?.length) {
      assert.strictEqual(body.lineItems[0].groupDiscount, undefined);
      assert.ok(typeof body.lineItems[0].finalPrice === "number");
    }
  });

  it("client order line items must not include basePrice, groupDiscount, managerOverride (BUG-004)", async () => {
    await ensureSeed();
    const app = await build();
    const clientLogin = await login(app, "client1@maxmarket.com", "ChangeMe1!");
    const order = await prisma.order.findFirst({ where: { orderNumber: "SEED-SUBMITTED-1" } });
    assert.ok(order);
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order!.id}`,
      headers: { authorization: `Bearer ${clientLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { lineItems?: Array<Record<string, unknown>> };
    assert.ok(body.lineItems?.length);
    for (const lineItem of body.lineItems!) {
      assert(!Object.prototype.hasOwnProperty.call(lineItem, "basePrice"), "basePrice must not be present for client");
      assert(!Object.prototype.hasOwnProperty.call(lineItem, "groupDiscount"), "groupDiscount must not be present for client");
      assert(!Object.prototype.hasOwnProperty.call(lineItem, "managerOverride"), "managerOverride must not be present for client");
    }
  });
});

describe("Phase 6 — Return flow (no stock restore)", () => {
  let toCleanProductId: string | undefined;
  afterEach(async () => {
    if (toCleanProductId) {
      await deleteProductAndRelated(toCleanProductId);
      toCleanProductId = undefined;
    }
  });
  it("return does not restore stock (status only per CTO-DEC-001)", async () => {
    await ensureSeed();
    const app = await build();
    const agentLogin = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    const managerLogin = await login(app, "manager1@maxmarket.com", "ChangeMe1!");
    const client = await prisma.user.findFirst({ where: { email: "client1@maxmarket.com" } });
    assert.ok(client);
    const { variantId, warehouseId, productId } = await createIsolatedVariantAndStock();
    toCleanProductId = productId;
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { authorization: `Bearer ${agentLogin.accessToken}` },
      payload: { clientId: client!.id, lineItems: [{ variantId, warehouseId, qty: 2 }] },
    });
    assert.strictEqual(createRes.statusCode, 201);
    const draft = JSON.parse(createRes.payload) as { id: string };
    await app.inject({ method: "POST", url: `/api/v1/orders/${draft.id}/submit`, headers: { authorization: `Bearer ${agentLogin.accessToken}` } });
    await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/approve`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    const fulfillRes = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${draft.id}/fulfill`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(fulfillRes.statusCode, 200);
    const order = JSON.parse(fulfillRes.payload) as { id: string; lineItems: Array<{ variantId: string; warehouseId: string }> };
    const li = order.lineItems[0];
    const stockBefore = await prisma.warehouseStock.findFirst({
      where: { warehouseId: li.warehouseId, productVariantId: li.variantId },
    });
    assert.ok(stockBefore);

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/orders/${order.id}/return`,
      headers: { authorization: `Bearer ${managerLogin.accessToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { status: string };
    assert.strictEqual(body.status, "returned");

    const stockAfter = await prisma.warehouseStock.findFirst({
      where: { warehouseId: li.warehouseId, productVariantId: li.variantId },
    });
    assert.ok(stockAfter);
    assert.strictEqual(stockAfter!.availableQty, stockBefore!.availableQty, "Return must not increment availableQty (DL-10)");
  });
});

describe("Phase 6 — Rate limiting", () => {
  it("login rate limit returns 429 with RATE_LIMITED and standard envelope", async () => {
    await ensureSeed();
    const app = await build();
    for (let i = 0; i < 12; i++) {
      await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "rate-limit-test@maxmarket.com", password: "wrong" },
      });
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "rate-limit-test@maxmarket.com", password: "wrong" },
    });
    if (res.statusCode === 429) {
      const body = JSON.parse(res.payload) as { errorCode?: string; correlationId?: string };
      assert.strictEqual(body.errorCode, ErrorCodes.RATE_LIMITED);
      assert.ok(body.correlationId);
    }
  });
});
