import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";
import { DEFAULT_WAREHOUSE_ID } from "../../lib/constants.js";

/** Ensure warehouse_stock row exists for variant (upsert to avoid unique constraint). DL-17. */
async function ensureStockForVariant(variantId: string): Promise<void> {
  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_productVariantId: {
        warehouseId: DEFAULT_WAREHOUSE_ID,
        productVariantId: variantId,
      },
    },
    create: {
      warehouseId: DEFAULT_WAREHOUSE_ID,
      productVariantId: variantId,
      availableQty: 0,
      reservedQty: 0,
    },
    update: {},
  });
}

export async function listProducts(
  query: PaginationQuery,
  filter: { search?: string; categoryId?: string }
) {
  const searchTerms = filter.search?.trim()
    ? filter.search.trim().split(/\s+/).filter(Boolean)
    : [];

  if (searchTerms.length > 0) {
    const conditions = searchTerms.map((term) => {
      const pattern = `%${term}%`;
      return Prisma.sql`(
        (p.name->>'en' ILIKE ${pattern})
        OR (COALESCE(p.name->>'hy','') ILIKE ${pattern})
        OR (COALESCE(p.name->>'ru','') ILIKE ${pattern})
        OR EXISTS (
          SELECT 1 FROM product_variants pv
          WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
          AND pv.sku ILIKE ${pattern}
        )
      )`;
    });
    const categoryCond = filter.categoryId
      ? Prisma.sql`AND p.category_id = ${filter.categoryId}::uuid`
      : Prisma.sql``;
    const [idRows, countResult] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id FROM products p
        WHERE p.deleted_at IS NULL
        ${categoryCond}
        AND ${Prisma.join(conditions, " AND ")}
        ORDER BY p.created_at DESC
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint as count FROM products p
        WHERE p.deleted_at IS NULL
        ${categoryCond}
        AND ${Prisma.join(conditions, " AND ")}
      `,
    ]);
    const ids = idRows.map((r) => r.id);
    const total = Number(countResult[0]?.count ?? 0);
    if (ids.length === 0) {
      return { rows: [], total: 0 };
    }
    const { skip, take } = skipTake(query);
    const pageIds = ids.slice(skip, skip + take);
    const products = await prisma.product.findMany({
      where: { id: { in: pageIds } },
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          where: { deletedAt: null },
          include: { images: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    const orderMap = new Map(products.map((p) => [p.id, p]));
    const rows = pageIds.map((id) => orderMap.get(id)).filter(Boolean) as typeof products;
    return { rows, total };
  }

  const where: {
    deletedAt: null;
    categoryId?: string;
  } = { deletedAt: null };
  if (filter.categoryId) where.categoryId = filter.categoryId;
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true } },
        variants: {
          where: { deletedAt: null },
          include: { images: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { rows, total };
}

export async function getProductById(id: string) {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      variants: {
        where: { deletedAt: null },
        include: { images: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function listCategories(query: PaginationQuery) {
  const where = { deletedAt: null };
  const [rows, total] = await Promise.all([
    prisma.category.findMany({
      where,
      ...skipTake(query),
      orderBy: { name: "asc" },
    }),
    prisma.category.count({ where }),
  ]);
  return { rows, total };
}

/** All categories (no pagination) for GET /catalog/categories per OpenAPI. */
export async function getAllCategories() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function createProduct(data: {
  categoryId?: string | null;
  name: Record<string, string>;
  description: Record<string, string>;
  variants: Array<{
    sku: string;
    unitType: string;
    minOrderQty: number;
    costPrice: number;
    pricePerUnit: number;
    pricePerBox?: number | null;
  }>;
}) {
  const product = await prisma.product.create({
    data: {
      categoryId: data.categoryId ?? null,
      name: data.name as object,
      description: data.description as object,
      variants: {
        create: data.variants.map((v) => ({
          sku: v.sku,
          unitType: v.unitType,
          minOrderQty: v.minOrderQty,
          costPrice: v.costPrice,
          pricePerUnit: v.pricePerUnit,
          pricePerBox: v.pricePerBox ?? null,
        })),
      },
    },
    include: {
      category: { select: { id: true, name: true } },
      variants: { include: { images: true } },
    },
  });
  for (const v of product.variants) {
    await ensureStockForVariant(v.id);
  }
  return product;
}

export async function updateProduct(
  id: string,
  data: { name?: Record<string, string>; description?: Record<string, string>; isActive?: boolean; categoryId?: string | null }
) {
  return prisma.product.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name as object }),
      ...(data.description != null && { description: data.description as object }),
      ...(data.isActive != null && { isActive: data.isActive }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
    include: {
      category: { select: { id: true, name: true } },
      variants: { where: { deletedAt: null }, include: { images: { orderBy: { sortOrder: "asc" } } } },
    },
  });
}

export async function deleteProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function countActiveOrdersWithProduct(productId: string): Promise<number> {
  return prisma.order.count({
    where: {
      deletedAt: null,
      status: { notIn: ["draft", "rejected", "cancelled", "returned"] },
      lineItems: { some: { variant: { productId } } },
    },
  });
}

export async function countActiveOrdersWithVariant(variantId: string): Promise<number> {
  return prisma.order.count({
    where: {
      deletedAt: null,
      status: { notIn: ["draft", "rejected", "cancelled", "returned"] },
      lineItems: { some: { variantId } },
    },
  });
}

export async function countOrdersReferencingVariantSku(variantId: string): Promise<number> {
  return prisma.orderLineItem.count({
    where: {
      order: {
        deletedAt: null,
        status: { notIn: ["draft", "rejected", "cancelled"] },
      },
      variantId,
    },
  });
}

export async function countProductsInCategory(categoryId: string): Promise<number> {
  return prisma.product.count({
    where: { categoryId, deletedAt: null },
  });
}

export async function getVariantById(variantId: string) {
  return prisma.productVariant.findFirst({
    where: { id: variantId, deletedAt: null },
    include: { product: { select: { id: true } }, images: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createVariant(productId: string, data: {
  sku: string;
  unitType: string;
  minOrderQty: number;
  costPrice: number;
  pricePerUnit: number;
  pricePerBox?: number | null;
}) {
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      sku: data.sku,
      unitType: data.unitType,
      minOrderQty: data.minOrderQty,
      costPrice: data.costPrice,
      pricePerUnit: data.pricePerUnit,
      pricePerBox: data.pricePerBox ?? null,
    },
    include: { images: true },
  });
  await ensureStockForVariant(variant.id);
  return variant;
}

export async function updateVariant(variantId: string, data: {
  sku?: string;
  unitType?: string;
  minOrderQty?: number;
  costPrice?: number;
  pricePerUnit?: number;
  pricePerBox?: number | null;
  isActive?: boolean;
}) {
  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      ...(data.sku != null && { sku: data.sku }),
      ...(data.unitType != null && { unitType: data.unitType }),
      ...(data.minOrderQty != null && { minOrderQty: data.minOrderQty }),
      ...(data.costPrice != null && { costPrice: data.costPrice }),
      ...(data.pricePerUnit != null && { pricePerUnit: data.pricePerUnit }),
      ...(data.pricePerBox !== undefined && { pricePerBox: data.pricePerBox }),
      ...(data.isActive != null && { isActive: data.isActive }),
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function deleteVariant(variantId: string) {
  return prisma.productVariant.update({
    where: { id: variantId },
    data: { deletedAt: new Date(), isActive: false },
  });
}

export async function addVariantImage(variantId: string, url: string, sortOrder?: number) {
  return prisma.productVariantImage.create({
    data: { variantId, url, sortOrder: sortOrder ?? 0 },
  });
}

export async function getVariantImage(imageId: string, variantId: string) {
  return prisma.productVariantImage.findFirst({
    where: { id: imageId, variantId },
  });
}

export async function deleteVariantImage(imageId: string) {
  return prisma.productVariantImage.delete({
    where: { id: imageId },
  });
}

export async function reorderVariantImages(variantId: string, imageIdsInOrder: string[]) {
  await prisma.$transaction(
    imageIdsInOrder.map((id, index) =>
      prisma.productVariantImage.updateMany({
        where: { id, variantId },
        data: { sortOrder: index },
      })
    )
  );
}

export async function createCategory(data: { name: Record<string, string> }) {
  return prisma.category.create({
    data: { name: data.name as object },
  });
}

export async function updateCategory(id: string, data: { name: Record<string, string> }) {
  return prisma.category.update({
    where: { id },
    data: { name: data.name as object },
  });
}

export async function deleteCategory(id: string) {
  return prisma.category.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
