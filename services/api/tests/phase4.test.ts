/**
 * Phase 4 targeted tests: Users RBAC, client group delete 409,
 * variant SKU 409, category delete 409, variant images reorder 422, agent clients 403.
 */
import { describe, it, afterEach, after } from "node:test";
import assert from "node:assert";
import { build } from "../src/server.js";
import { ErrorCodes } from "../src/lib/errors.js";
import { ensureSeed } from "./helpers/seed.js";
import { prisma } from "../src/lib/prisma.js";

const ADMIN_EMAIL = "super_admin@maxmarket.com";
const ADMIN_PASSWORD = "ChangeMe1!";

async function login(app: Awaited<ReturnType<typeof build>>, email: string, password: string): Promise<string | null> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) return null;
  const body = JSON.parse(res.payload) as { accessToken?: string };
  return body.accessToken ?? null;
}

async function getAdminToken(app: Awaited<ReturnType<typeof build>>): Promise<string | null> {
  return login(app, ADMIN_EMAIL, ADMIN_PASSWORD);
}

/** Remove all Phase 4 test artifacts — safety net when tests run in parallel or afterEach fails. */
async function cleanupPhase4Artifacts(): Promise<void> {
  // 1. Users first (they reference client groups)
  await prisma.user.deleteMany({
    where: { email: { contains: "phase4-client-", mode: "insensitive" } },
  });
  // 2. Client groups (Phase4-Test-Group-*)
  await prisma.clientGroup.deleteMany({
    where: { name: { startsWith: "Phase4-Test-Group-" } },
  });
  // 3. Categories and products (Phase4 Cat / Phase4 Product) — products must be deleted before categories
  const phase4Cats = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const phase4CatIds = phase4Cats
    .filter((c) => {
      const name = c.name as Record<string, string> | null;
      return name?.en?.startsWith?.("Phase4 Cat ");
    })
    .map((c) => c.id);
  if (phase4CatIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { categoryId: { in: phase4CatIds } },
      select: { id: true },
    });
    for (const p of products) {
      const variants = await prisma.productVariant.findMany({ where: { productId: p.id }, select: { id: true } });
      const vids = variants.map((v) => v.id);
      if (vids.length > 0) {
        await prisma.orderLineItem.deleteMany({ where: { variantId: { in: vids } } });
        await prisma.warehouseStock.deleteMany({ where: { productVariantId: { in: vids } } });
        await prisma.productVariantImage.deleteMany({ where: { variantId: { in: vids } } });
        await prisma.productVariant.deleteMany({ where: { productId: p.id } });
      }
      await prisma.product.deleteMany({ where: { id: p.id } });
    }
    await prisma.category.deleteMany({ where: { id: { in: phase4CatIds } } });
  }
}

after(async () => {
  await cleanupPhase4Artifacts();
});

describe("Phase 4 — Users RBAC", () => {
  it("agent updating another user returns 403 FORBIDDEN", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/users?pageSize=50",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    if (listRes.statusCode !== 200) {
      throw new Error(`Expected 200 from /users, got ${listRes.statusCode}`);
    }
    const listBody = JSON.parse(listRes.payload) as { data?: Array<{ id: string; role: string }> };
    const users = listBody.data ?? [];
    const agent = users.find((u) => u.role === "agent");
    const other = users.find((u) => u.role !== "agent" && u.id !== agent?.id);
    if (!agent || !other) {
      throw new Error("Seed must provide at least one agent and another user");
    }

    const agentToken = await login(app, "agent1@maxmarket.com", "ChangeMe1!");
    if (!agentToken) {
      throw new Error("Expected agent token from seeded data");
    }

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/users/${other.id}`,
      headers: { authorization: `Bearer ${agentToken}` },
      payload: { fullName: "Other Name" },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
    assert.ok(body.correlationId);
  });
});

describe("Phase 4 — Client group delete blocked when clients assigned", () => {
  let createdGroupId: string | undefined;
  let createdUserId: string | undefined;
  afterEach(async () => {
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
      createdUserId = undefined;
    }
    if (createdGroupId) {
      await prisma.clientGroup.deleteMany({ where: { id: createdGroupId } });
      createdGroupId = undefined;
    }
  });
  it("DELETE /api/v1/client-groups/:id returns 409 when clients are in group", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/client-groups",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: "Phase4-Test-Group-" + Date.now(), discountType: "percentage", discountValue: 5 },
    });
    if (createRes.statusCode !== 201) {
      throw new Error(`Expected 201 from create client-group, got ${createRes.statusCode}`);
    }
    const group = JSON.parse(createRes.payload) as { id: string };
    createdGroupId = group.id;

    const createUserRes = await app.inject({
      method: "POST",
      url: "/api/v1/users",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: "phase4-client-" + Date.now() + "@test.com",
        password: "TestPass123!",
        fullName: "Phase4 Client",
        role: "client",
        clientGroupId: group.id,
      },
    });
    if (createUserRes.statusCode !== 201) {
      throw new Error(`Expected 201 from create user in group, got ${createUserRes.statusCode}`);
    }
    const userBody = JSON.parse(createUserRes.payload) as { id: string };
    createdUserId = userBody.id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/client-groups/${group.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(deleteRes.statusCode, 409);
    const body = JSON.parse(deleteRes.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.CONFLICT);
    assert.ok(body.correlationId);
  });
});

describe("Phase 4 — Variant SKU update blocked when active order references", () => {
  it("PUT variant SKU returns 409 when non-draft order references variant", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const prisma = (await import("../src/lib/prisma.js")).prisma;
    const orderWithVariant = await prisma.order.findFirst({
      where: {
        deletedAt: null,
        status: { notIn: ["draft", "rejected", "cancelled"] },
        lineItems: { some: {} },
      },
      select: {
        lineItems: { take: 1, select: { variantId: true, variant: { select: { productId: true } } } },
      },
    });
    if (!orderWithVariant?.lineItems?.length) {
      throw new Error("Seed must provide at least one non-draft order with line items");
    }
    const variantId = orderWithVariant.lineItems[0].variantId;
    const productId = orderWithVariant.lineItems[0].variant?.productId;
    if (!productId) {
      throw new Error("Expected productId on variant line item");
    }

    const putRes = await app.inject({
      method: "PUT",
      url: `/api/v1/catalog/products/${productId}/variants/${variantId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { sku: "NEW-SKU-" + Date.now() },
    });
    assert.strictEqual(putRes.statusCode, 409);
    const body = JSON.parse(putRes.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.CONFLICT);
  });
});

describe("Phase 4 — Category delete blocked when products assigned", () => {
  let createdCategoryId: string | undefined;
  let createdProductId: string | undefined;
  afterEach(async () => {
    if (createdProductId) {
      const variants = await prisma.productVariant.findMany({ where: { productId: createdProductId! }, select: { id: true } });
      const variantIds = variants.map((v) => v.id);
      await prisma.warehouseStock.deleteMany({ where: { productVariantId: { in: variantIds } } });
      await prisma.productVariant.deleteMany({ where: { productId: createdProductId! } });
      await prisma.product.deleteMany({ where: { id: createdProductId! } });
      createdProductId = undefined;
    }
    if (createdCategoryId) {
      await prisma.category.deleteMany({ where: { id: createdCategoryId } });
      createdCategoryId = undefined;
    }
  });
  it("DELETE /api/v1/catalog/categories/:id returns 409 when products in category", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const catRes = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/categories",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: { en: "Phase4 Cat " + Date.now() } },
    });
    if (catRes.statusCode !== 201) {
      throw new Error(`Expected 201 from create category, got ${catRes.statusCode}`);
    }
    const category = JSON.parse(catRes.payload) as { id: string };
    createdCategoryId = category.id;

    const prodRes = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/products",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: { en: "Phase4 Product" },
        description: { en: "" },
        categoryId: category.id,
        variants: [{ sku: "P4-SKU-" + Date.now(), unitType: "piece", minOrderQty: 1, costPrice: 1, pricePerUnit: 1 }],
      },
    });
    if (prodRes.statusCode !== 201) {
      throw new Error(`Expected 201 from create product, got ${prodRes.statusCode}`);
    }
    const productBody = JSON.parse(prodRes.payload) as { id: string };
    createdProductId = productBody.id;

    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/catalog/categories/${category.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(deleteRes.statusCode, 409);
    const body = JSON.parse(deleteRes.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.CONFLICT);
    assert.ok(body.correlationId);
  });
});

describe("Phase 4 — Variant images reorder validation", () => {
  it("PUT reorder with unknown image IDs returns 422 VALIDATION_ERROR", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/products?pageSize=5",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    if (listRes.statusCode !== 200) {
      throw new Error(`Expected 200 from products list, got ${listRes.statusCode}`);
    }
    const listBody = JSON.parse(listRes.payload) as { data?: Array<{ id: string; variants?: Array<{ id: string }> }> };
    const product = listBody.data?.find((p) => p.variants?.length);
    if (!product?.variants?.length) {
      throw new Error("Seed must provide at least one product with variants");
    }

    const productId = product.id;
    const variantId = product.variants[0].id;

    const res = await app.inject({
      method: "PUT",
      url: `/api/v1/catalog/products/${productId}/variants/${variantId}/images/reorder`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { imageIds: ["00000000-0000-0000-0000-000000000001"] },
    });
    assert.strictEqual(res.statusCode, 422);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.VALIDATION_ERROR);
    assert.ok(body.correlationId);
  });
});

describe("Phase 4 — Agent can only see own assigned clients", () => {
  it("GET /api/v1/users/:agentId/clients returns 403 when agentId is not self (agent)", async () => {
    await ensureSeed();
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }

    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/users?pageSize=50",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    if (listRes.statusCode !== 200) {
      throw new Error(`Expected 200 from /users, got ${listRes.statusCode}`);
    }
    const listBody = JSON.parse(listRes.payload) as { data?: Array<{ id: string; role: string }> };
    const agents = (listBody.data ?? []).filter((u) => u.role === "agent");
    if (agents.length < 2) {
      throw new Error("Seed must provide at least two agents");
    }

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "agent1@maxmarket.com", password: "ChangeMe1!" },
    });
    if (loginRes.statusCode !== 200) {
      throw new Error(`Expected 200 from agent login, got ${loginRes.statusCode}`);
    }
    const loginBody = JSON.parse(loginRes.payload) as { user?: { id: string }; accessToken?: string };
    const agentAId = loginBody.user?.id;
    const agentAToken = loginBody.accessToken;
    if (!agentAId || !agentAToken) {
      throw new Error("Expected agent login response to include user and accessToken");
    }

    const agentB = agents.find((a) => a.id !== agentAId);
    if (!agentB) {
      throw new Error("Seed must provide at least one other agent");
    }

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/users/${agentB.id}/clients`,
      headers: { authorization: `Bearer ${agentAToken}` },
    });
    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.payload) as Record<string, unknown>;
    assert.strictEqual(body.errorCode, ErrorCodes.FORBIDDEN);
    assert.ok(body.correlationId);
  });
});

describe("Phase 4 — Client groups no test pollution", () => {
  it("GET /client-groups returns only seed groups (Default Clients, Premium Clients)", async () => {
    await ensureSeed();
    await prisma.clientGroup.deleteMany({
      where: { name: { notIn: ["Default Clients", "Premium Clients"] } },
    });
    const app = await build();
    const adminToken = await getAdminToken(app);
    if (!adminToken) {
      throw new Error("Expected admin token from seeded data");
    }
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/client-groups?pageSize=50",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.payload) as { data?: Array<{ name: string }> };
    const groups = body.data ?? [];
    const names = groups.map((g) => g.name);
    assert.ok(names.includes("Default Clients"), "Must include Default Clients");
    assert.ok(names.includes("Premium Clients"), "Must include Premium Clients");
    const testPollution = names.filter((n) => n.startsWith("Phase4-Test-Group-"));
    assert.strictEqual(testPollution.length, 0, `No Phase4-Test-Group-* entries; found: ${testPollution.join(", ") || "none"}`);
  });
});
