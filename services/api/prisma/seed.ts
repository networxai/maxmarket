/**
 * MaxMarket seed — idempotent. Cleans test artifacts (Phase4/5/6) at start.
 * For a full clean DB: from project root run `npm run dev:reset` (drops volumes).
 * Or run `npx prisma db seed` — it removes Phase4-Test-Group-*, phase4-client-*, etc.
 */
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/auth/auth-service.js";
import { en as enStrings, hy as hyStrings, ru as ruStrings } from "./i18n-seed-data.js";

async function upsertUser(params: {
  email: string;
  password: string;
  fullName: string;
  role: "super_admin" | "admin" | "manager" | "agent" | "client";
  preferredLanguage?: string;
  clientGroupName?: string | null;
}) {
  const email = params.email.toLowerCase();
  let clientGroupId: string | null = null;
  if (params.clientGroupName) {
    const cg = await prisma.clientGroup.upsert({
      where: { name: params.clientGroupName },
      update: {},
      create: {
        name: params.clientGroupName,
        discountType: "percentage",
        discountValue: 5,
      },
    });
    clientGroupId = cg.id;
  }
  const passwordHash = await hashPassword(params.password);
  return prisma.user.upsert({
    where: { email },
    update: {
      fullName: params.fullName,
      role: params.role,
      preferredLanguage: params.preferredLanguage ?? "en",
      clientGroupId: clientGroupId,
      isActive: true,
      deletedAt: null,
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      fullName: params.fullName,
      role: params.role,
      preferredLanguage: params.preferredLanguage ?? "en",
      clientGroupId,
    },
  });
}

export async function runSeed(): Promise<void> {
  // Remove test user artifacts (phase4, phase5, QA, etc.)
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "phase4-client-", mode: "insensitive" } },
        { email: "unassigned-client@maxmarket.com" },
        { email: { contains: "@test.com", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (testUsers.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: testUsers.map((u) => u.id) } } });
  }
  await prisma.clientGroup.deleteMany({
    where: { name: { notIn: ["Default Clients", "Premium Clients"] } },
  });
  await prisma.order.deleteMany({
    where: { orderNumber: { startsWith: "SEED-STOCK-" } },
  });

  /** Delete product and related (line items, stock, images, variants). */
  async function deleteProductCascade(pid: string): Promise<void> {
    const variants = await prisma.productVariant.findMany({ where: { productId: pid }, select: { id: true } });
    const vids = variants.map((v) => v.id);
    if (vids.length > 0) {
      await prisma.orderLineItem.deleteMany({ where: { variantId: { in: vids } } });
      await prisma.warehouseStock.deleteMany({ where: { productVariantId: { in: vids } } });
      await prisma.productVariantImage.deleteMany({ where: { variantId: { in: vids } } });
      await prisma.productVariant.deleteMany({ where: { productId: pid } });
    }
    await prisma.product.deleteMany({ where: { id: pid } });
  }

  // Product name patterns (name.en) — test artifacts from all phases
  const productNamePatterns = [
    "Reg Product",
    "DL-17 Test Product",
    "DL17 Test Product",
    "RBAC Product",
    "RBAC ", // "RBAC 1772214071390"
    "QA Cat Product",
    "QA Test",
    "Phase4 Cat ",
    "Phase4 Product",
    "Phase5",
    "P6 Iso Product",
    "Test Product",
  ];

  const allProds = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const testProductIdsByName = new Set(
    allProds
      .filter((p) => {
        const n = (p.name as Record<string, string> | null)?.en;
        if (typeof n !== "string") return false;
        return productNamePatterns.some((pat) => n.includes(pat.trim()) || n.startsWith(pat.trim()));
      })
      .map((p) => p.id)
  );

  // SKU patterns — catch variants from Reg, RBAC, QA, DL17, P6, etc.
  const skuPrefixes = ["REG-", "DL17-", "RBAC-", "QA-CAT-", "QA-VAR-", "P4-SKU-", "P6-ISO-", "NEW-SKU-"];
  const testVariantsBySku = await prisma.productVariant.findMany({
    where: {
      OR: skuPrefixes.map((prefix) => ({ sku: { startsWith: prefix } })),
    },
    select: { productId: true },
  });
  for (const v of testVariantsBySku) {
    testProductIdsByName.add(v.productId);
  }
  // SKU "R-" + timestamp (e.g. R-1772214071390)
  const rVariants = await prisma.productVariant.findMany({
    where: { sku: { startsWith: "R-" } },
    select: { productId: true, sku: true },
  });
  for (const v of rVariants) {
    if (/^R-\d{10,}$/.test(v.sku)) testProductIdsByName.add(v.productId);
  }

  for (const pid of testProductIdsByName) {
    await deleteProductCascade(pid);
  }

  // Test category patterns
  const categoryNamePatterns = ["Phase4 Cat ", "QA Cat", "RBAC Cat", "Test Cat"];
  const allCats = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const testCatIds = allCats
    .filter((c) => {
      const n = (c.name as Record<string, string> | null)?.en;
      if (typeof n !== "string") return false;
      return categoryNamePatterns.some((pat) => n.includes(pat) || n.startsWith(pat));
    })
    .map((c) => c.id);
  if (testCatIds.length > 0) {
    const productsInCats = await prisma.product.findMany({
      where: { categoryId: { in: testCatIds } },
      select: { id: true },
    });
    for (const p of productsInCats) {
      await deleteProductCascade(p.id);
    }
    await prisma.category.deleteMany({ where: { id: { in: testCatIds } } });
  }

  // Client groups
  const defaultGroup = await prisma.clientGroup.upsert({
    where: { name: "Default Clients" },
    update: {},
    create: {
      name: "Default Clients",
      discountType: "percentage",
      discountValue: 10,
    },
  });
  const premiumGroup = await prisma.clientGroup.upsert({
    where: { name: "Premium Clients" },
    update: {},
    create: {
      name: "Premium Clients",
      discountType: "percentage",
      discountValue: 15,
    },
  });

  // Users
  const superAdmin = await upsertUser({
    email: "super_admin@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Super Admin",
    role: "super_admin",
  });
  const admin = await upsertUser({
    email: "admin1@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Admin One",
    role: "admin",
  });
  const manager = await upsertUser({
    email: "manager1@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Manager One",
    role: "manager",
  });
  const agent = await upsertUser({
    email: "agent1@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Agent One",
    role: "agent",
  });
  const agentTwo = await upsertUser({
    email: "agent2@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Agent Two",
    role: "agent",
  });
  const client = await upsertUser({
    email: "client1@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Client One",
    role: "client",
    clientGroupName: defaultGroup.name,
  });
  const client2 = await upsertUser({
    email: "client2@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Client Two",
    role: "client",
    clientGroupName: premiumGroup.name,
  });
  const client3 = await upsertUser({
    email: "client3@maxmarket.com",
    password: "ChangeMe1!",
    fullName: "Client Three",
    role: "client",
    clientGroupName: defaultGroup.name,
  });

  // Agent-client assignments: agent1→client1, agent1→client2, agent2→client3
  await prisma.agentClientAssignment.upsert({
    where: {
      agentId_clientId: { agentId: agent.id, clientId: client.id },
    },
    update: {},
    create: { agentId: agent.id, clientId: client.id },
  });
  await prisma.agentClientAssignment.upsert({
    where: {
      agentId_clientId: { agentId: agent.id, clientId: client2.id },
    },
    update: {},
    create: { agentId: agent.id, clientId: client2.id },
  });
  await prisma.agentClientAssignment.upsert({
    where: {
      agentId_clientId: { agentId: agentTwo.id, clientId: client3.id },
    },
    update: {},
    create: { agentId: agentTwo.id, clientId: client3.id },
  });

  // Categories: Beverages (seed), Snacks, Household
  const catBeverages = await prisma.category.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { name: { en: "Beverages" } as unknown as object },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: { en: "Beverages" } as unknown as object,
    },
  });
  const catSnacks = await prisma.category.upsert({
    where: { id: "00000000-0000-0000-0000-000000000011" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      name: { en: "Snacks" } as unknown as object,
    },
  });
  const catHousehold = await prisma.category.upsert({
    where: { id: "00000000-0000-0000-0000-000000000021" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000021",
      name: { en: "Household" } as unknown as object,
    },
  });

  // Warehouse (single seed warehouse)
  const warehouse = await prisma.warehouse.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      name: "Seed Warehouse",
      stockAuthority: "internal",
    },
  });

  // Products + variants (10 products, 1–3 variants each). IDs/skus deterministic for upsert.
  const productIds = [
    "00000000-0000-0000-0000-000000000002",
    "00000000-0000-0000-0000-000000000003",
    "00000000-0000-0000-0000-000000000004",
    "00000000-0000-0000-0000-000000000005",
    "00000000-0000-0000-0000-000000000006",
    "00000000-0000-0000-0000-000000000007",
    "00000000-0000-0000-0000-000000000008",
    "00000000-0000-0000-0000-000000000009",
    "00000000-0000-0000-0000-00000000000a",
    "00000000-0000-0000-0000-00000000000b",
  ];
  const productDefs: { name: string; categoryId: string; variants: { sku: string; price: number; unit: string }[] }[] = [
    { name: "Seed Product", categoryId: catBeverages.id, variants: [{ sku: "SEED-SKU-1", price: 10, unit: "piece" }] },
    { name: "Cola", categoryId: catBeverages.id, variants: [{ sku: "BEV-COLA-1", price: 2.5, unit: "piece" }, { sku: "BEV-COLA-6", price: 12, unit: "box" }] },
    { name: "Juice", categoryId: catBeverages.id, variants: [{ sku: "BEV-JUICE-1", price: 3, unit: "piece" }] },
    { name: "Water", categoryId: catBeverages.id, variants: [{ sku: "BEV-WATER-1", price: 1, unit: "piece" }, { sku: "BEV-WATER-24", price: 20, unit: "box" }] },
    { name: "Chips", categoryId: catSnacks.id, variants: [{ sku: "SNACK-CHIPS-1", price: 2, unit: "piece" }, { sku: "SNACK-CHIPS-12", price: 18, unit: "box" }] },
    { name: "Cookies", categoryId: catSnacks.id, variants: [{ sku: "SNACK-COOKIES-1", price: 4, unit: "piece" }] },
    { name: "Crackers", categoryId: catSnacks.id, variants: [{ sku: "SNACK-CRACK-1", price: 3, unit: "piece" }, { sku: "SNACK-CRACK-6", price: 15, unit: "box" }] },
    { name: "Soap", categoryId: catHousehold.id, variants: [{ sku: "HH-SOAP-1", price: 2, unit: "piece" }] },
    { name: "Tissue", categoryId: catHousehold.id, variants: [{ sku: "HH-TISSUE-1", price: 5, unit: "piece" }, { sku: "HH-TISSUE-12", price: 48, unit: "box" }] },
    { name: "Cleaner", categoryId: catHousehold.id, variants: [{ sku: "HH-CLEAN-1", price: 8, unit: "piece" }] },
  ];
  /** picsum.photos URLs — deterministic seeds for consistent images across seed runs */
  const seedImages: Record<string, { url: string; sortOrder: number }[]> = {
    "SEED-SKU-1": [
      { url: "https://picsum.photos/seed/seed-product-1/400/400", sortOrder: 0 },
      { url: "https://picsum.photos/seed/seed-product-2/400/400", sortOrder: 1 },
    ],
    "BEV-COLA-1": [
      { url: "https://picsum.photos/seed/cola-single-1/400/400", sortOrder: 0 },
      { url: "https://picsum.photos/seed/cola-single-2/400/400", sortOrder: 1 },
    ],
    "BEV-COLA-6": [
      { url: "https://picsum.photos/seed/cola-box-1/400/400", sortOrder: 0 },
    ],
    "BEV-JUICE-1": [
      { url: "https://picsum.photos/seed/juice-1/400/400", sortOrder: 0 },
      { url: "https://picsum.photos/seed/juice-2/400/400", sortOrder: 1 },
    ],
    "BEV-WATER-1": [
      { url: "https://picsum.photos/seed/water-single-1/400/400", sortOrder: 0 },
      { url: "https://picsum.photos/seed/water-single-2/400/400", sortOrder: 1 },
    ],
    "BEV-WATER-24": [
      { url: "https://picsum.photos/seed/water-box-1/400/400", sortOrder: 0 },
    ],
    "SNACK-CHIPS-1": [
      { url: "https://picsum.photos/seed/chips-single-1/400/400", sortOrder: 0 },
      { url: "https://picsum.photos/seed/chips-single-2/400/400", sortOrder: 1 },
    ],
    "SNACK-CHIPS-12": [
      { url: "https://picsum.photos/seed/chips-box-1/400/400", sortOrder: 0 },
    ],
    "SNACK-COOKIES-1": [
      { url: "https://picsum.photos/seed/cookies-1/400/400", sortOrder: 0 },
    ],
    "SNACK-CRACK-1": [
      { url: "https://picsum.photos/seed/crackers-1/400/400", sortOrder: 0 },
    ],
    "SNACK-CRACK-6": [
      { url: "https://picsum.photos/seed/crackers-box-1/400/400", sortOrder: 0 },
    ],
    "HH-SOAP-1": [
      { url: "https://picsum.photos/seed/soap-1/400/400", sortOrder: 0 },
    ],
    "HH-TISSUE-1": [
      { url: "https://picsum.photos/seed/tissue-1/400/400", sortOrder: 0 },
    ],
    "HH-TISSUE-12": [
      { url: "https://picsum.photos/seed/tissue-box-1/400/400", sortOrder: 0 },
    ],
    "HH-CLEAN-1": [
      { url: "https://picsum.photos/seed/cleaner-1/400/400", sortOrder: 0 },
    ],
  };

  const variantIds: string[] = [];
  for (let i = 0; i < productDefs.length; i++) {
    const def = productDefs[i]!;
    const product = await prisma.product.upsert({
      where: { id: productIds[i]! },
      update: { categoryId: def.categoryId },
      create: {
        id: productIds[i]!,
        categoryId: def.categoryId,
        name: { en: def.name } as unknown as object,
        description: { en: `${def.name} description` } as unknown as object,
      },
    });
    for (const v of def.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: { productId: product.id, isActive: true, deletedAt: null, pricePerUnit: v.price },
        create: {
          productId: product.id,
          sku: v.sku,
          unitType: v.unit === "box" ? "box" : "piece",
          minOrderQty: 1,
          costPrice: v.price * 0.5,
          pricePerUnit: v.price,
          pricePerBox: v.unit === "box" ? v.price : null,
        },
      });
      variantIds.push(variant.id);
      await prisma.warehouseStock.upsert({
        where: {
          warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variant.id },
        },
        update: {},
        create: {
          warehouseId: warehouse.id,
          productVariantId: variant.id,
          availableQty: v.sku === "SNACK-CHIPS-1" ? 5 : 100,
          reservedQty: v.sku === "SNACK-CHIPS-1" ? 3 : 10,
        },
      });
    }
  }

  // Add real product images to all seed variants (picsum.photos — publicly accessible)
  for (const [sku, images] of Object.entries(seedImages)) {
    const variant = await prisma.productVariant.findFirst({ where: { sku } });
    if (!variant) continue;
    await prisma.productVariantImage.deleteMany({ where: { variantId: variant.id } });
    await prisma.productVariantImage.createMany({
      data: images.map((img) => ({
        variantId: variant.id,
        url: img.url,
        sortOrder: img.sortOrder,
      })),
    });
  }

  const v1 = variantIds[0]!;
  const baseLineItem = {
    variantId: v1,
    warehouseId: warehouse.id,
    qty: 5,
    unitType: "piece",
    basePrice: 10,
    groupDiscount: 0,
    managerOverride: null as number | null,
    finalPrice: 10,
  };

  // Orders: 2 draft, 2 submitted, 2 approved, 2 fulfilled, 1 rejected, 1 cancelled, 1 returned, 1 with 3+ line items, 1 with manager override, 1 versioned
  await prisma.order.upsert({
    where: { orderNumber: "SEED-DRAFT-1" },
    update: {},
    create: {
      orderNumber: "SEED-DRAFT-1",
      clientId: client.id,
      agentId: agent.id,
      status: "draft",
      lineItems: { create: baseLineItem },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-DRAFT-2" },
    update: {},
    create: {
      orderNumber: "SEED-DRAFT-2",
      clientId: client3.id,
      agentId: agentTwo.id,
      status: "draft",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[1] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-SUBMITTED-1" },
    update: {},
    create: {
      orderNumber: "SEED-SUBMITTED-1",
      clientId: client.id,
      agentId: agent.id,
      status: "submitted",
      lineItems: { create: baseLineItem },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-SUBMITTED-2" },
    update: {},
    create: {
      orderNumber: "SEED-SUBMITTED-2",
      clientId: client2.id,
      agentId: agent.id,
      status: "submitted",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[2] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-APPROVED-1" },
    update: {},
    create: {
      orderNumber: "SEED-APPROVED-1",
      clientId: client.id,
      agentId: agent.id,
      status: "approved",
      versionLock: 1,
      lineItems: { create: baseLineItem },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-APPROVED-2" },
    update: {},
    create: {
      orderNumber: "SEED-APPROVED-2",
      clientId: client3.id,
      agentId: agentTwo.id,
      status: "approved",
      versionLock: 1,
      lineItems: { create: { ...baseLineItem, variantId: variantIds[3] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-FULFILLED-1" },
    update: {},
    create: {
      orderNumber: "SEED-FULFILLED-1",
      clientId: client.id,
      agentId: agent.id,
      status: "fulfilled",
      lineItems: { create: baseLineItem },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-FULFILLED-2" },
    update: {},
    create: {
      orderNumber: "SEED-FULFILLED-2",
      clientId: client2.id,
      agentId: agent.id,
      status: "fulfilled",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[4] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-REJECTED-1" },
    update: {},
    create: {
      orderNumber: "SEED-REJECTED-1",
      clientId: client3.id,
      agentId: agentTwo.id,
      status: "rejected",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[5] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-CANCELLED-1" },
    update: {},
    create: {
      orderNumber: "SEED-CANCELLED-1",
      clientId: client.id,
      agentId: agent.id,
      status: "cancelled",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[6] ?? v1 } },
    },
  });
  await prisma.order.upsert({
    where: { orderNumber: "SEED-RETURNED-1" },
    update: {},
    create: {
      orderNumber: "SEED-RETURNED-1",
      clientId: client2.id,
      agentId: agent.id,
      status: "returned",
      lineItems: { create: { ...baseLineItem, variantId: variantIds[7] ?? v1 } },
    },
  });
  const orderMultiLine = await prisma.order.upsert({
    where: { orderNumber: "SEED-MULTILINE-1" },
    update: {},
    create: {
      orderNumber: "SEED-MULTILINE-1",
      clientId: client.id,
      agentId: agent.id,
      status: "draft",
      lineItems: {
        create: [
          { ...baseLineItem, qty: 2 },
          { ...baseLineItem, variantId: variantIds[1] ?? v1, basePrice: 2.5, finalPrice: 2.5, qty: 4 },
          { ...baseLineItem, variantId: variantIds[2] ?? v1, basePrice: 3, finalPrice: 3, qty: 1 },
        ],
      },
    },
  });
  const orderOverride = await prisma.order.upsert({
    where: { orderNumber: "SEED-OVERRIDE-1" },
    update: {},
    create: {
      orderNumber: "SEED-OVERRIDE-1",
      clientId: client2.id,
      agentId: agent.id,
      status: "submitted",
      lineItems: {
        create: {
          ...baseLineItem,
          managerOverride: 7.5,
          finalPrice: 7.5,
        },
      },
    },
  });
  const orderVersioned = await prisma.order.upsert({
    where: { orderNumber: "SEED-VERSIONED-1" },
    update: {},
    create: {
      orderNumber: "SEED-VERSIONED-1",
      clientId: client.id,
      agentId: agent.id,
      status: "submitted",
      currentVersion: 2,
      versionLock: 2,
      lineItems: { create: baseLineItem },
    },
  });
  const adminUser = await prisma.user.findFirst({ where: { email: "admin1@maxmarket.com" } });
  if (adminUser) {
    await prisma.orderVersion.upsert({
      where: { orderId_versionNumber: { orderId: orderVersioned.id, versionNumber: 1 } },
      update: {},
      create: {
        orderId: orderVersioned.id,
        versionNumber: 1,
        snapshot: { status: "approved", versionLock: 1, lineItems: [] } as unknown as object,
        createdBy: adminUser.id,
      },
    });
  }

  // I18n ui-strings (en, hy, ru) — 268 keys from fallback-strings.ts
  for (const [key, value] of Object.entries(enStrings)) {
    await prisma.uiTranslation.upsert({
      where: { language_key: { language: "en", key } },
      create: { language: "en", key, value },
      update: { value },
    });
  }
  for (const [key, value] of Object.entries(hyStrings)) {
    await prisma.uiTranslation.upsert({
      where: { language_key: { language: "hy", key } },
      create: { language: "hy", key, value },
      update: { value },
    });
  }
  for (const [key, value] of Object.entries(ruStrings)) {
    await prisma.uiTranslation.upsert({
      where: { language_key: { language: "ru", key } },
      create: { language: "ru", key, value },
      update: { value },
    });
  }
}

// Prisma CLI / direct execution entrypoint
runSeed()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


