/**
 * Test cleanup helpers — delete test-created resources to avoid polluting the database.
 */
import { prisma } from "../../src/lib/prisma.js";

/** Delete product and all related: orders (via line items), order versions, warehouse stock, images, variants. */
export async function deleteProductAndRelated(productId: string): Promise<void> {
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    select: { id: true },
  });
  const variantIds = variants.map((v) => v.id);
  if (variantIds.length === 0) {
    await prisma.product.delete({ where: { id: productId } }).catch(() => {});
    return;
  }
  const ordersWithVariants = await prisma.order.findMany({
    where: {
      lineItems: { some: { variantId: { in: variantIds } } },
    },
    select: { id: true },
  });
  const orderIds = ordersWithVariants.map((o) => o.id);
  await prisma.orderVersion.deleteMany({ where: { orderId: { in: orderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.warehouseStock.deleteMany({ where: { productVariantId: { in: variantIds } } });
  await prisma.productVariantImage.deleteMany({ where: { variantId: { in: variantIds } } });
  await prisma.productVariant.deleteMany({ where: { id: { in: variantIds } } });
  await prisma.product.delete({ where: { id: productId } });
}

/** Remove all test catalog artifacts (products, categories) — safety net for test leakage. */
export async function cleanupTestCatalogArtifacts(): Promise<void> {
  const productNamePatterns = [
    "Reg Product",
    "DL-17 Test Product",
    "DL17 Test Product",
    "RBAC Product",
    "RBAC ",
    "QA Cat Product",
    "QA Test",
    "Phase4 Cat ",
    "Phase4 Product",
    "P6 Iso Product",
    "Test Product",
  ];
  const skuPrefixes = ["REG-", "DL17-", "RBAC-", "QA-CAT-", "QA-VAR-", "P4-SKU-", "P6-ISO-", "NEW-SKU-"];

  const allProds = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const testIds = new Set(
    allProds
      .filter((p) => {
        const n = (p.name as Record<string, string> | null)?.en;
        if (typeof n !== "string") return false;
        return productNamePatterns.some((pat) => n.includes(pat.trim()) || n.startsWith(pat.trim()));
      })
      .map((p) => p.id)
  );
  const variantsBySku = await prisma.productVariant.findMany({
    where: { OR: skuPrefixes.map((p) => ({ sku: { startsWith: p } })) },
    select: { productId: true },
  });
  for (const v of variantsBySku) testIds.add(v.productId);
  const rVariants = await prisma.productVariant.findMany({
    where: { sku: { startsWith: "R-" } },
    select: { productId: true, sku: true },
  });
  for (const v of rVariants) {
    if (/^R-\d{10,}$/.test(v.sku)) testIds.add(v.productId);
  }
  for (const pid of testIds) {
    await deleteProductAndRelated(pid);
  }

  const categoryPatterns = ["Phase4 Cat ", "QA Cat", "RBAC Cat", "Test Cat"];
  const allCats = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const testCatIds = allCats
    .filter((c) => {
      const n = (c.name as Record<string, string> | null)?.en;
      if (typeof n !== "string") return false;
      return categoryPatterns.some((pat) => n.includes(pat) || n.startsWith(pat));
    })
    .map((c) => c.id);
  if (testCatIds.length > 0) {
    const prodsInCats = await prisma.product.findMany({
      where: { categoryId: { in: testCatIds } },
      select: { id: true },
    });
    for (const p of prodsInCats) await deleteProductAndRelated(p.id);
    await prisma.category.deleteMany({ where: { id: { in: testCatIds } } });
  }
}
