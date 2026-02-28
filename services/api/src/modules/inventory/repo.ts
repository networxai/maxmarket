import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";

export async function listStock(
  query: PaginationQuery,
  filter: { warehouseId?: string; variantId?: string }
) {
  const where: { warehouseId?: string; productVariantId?: string } = {};
  if (filter.warehouseId) where.warehouseId = filter.warehouseId;
  if (filter.variantId) where.productVariantId = filter.variantId;
  const [rows, total] = await Promise.all([
    prisma.warehouseStock.findMany({
      where,
      ...skipTake(query),
      include: {
        warehouse: { select: { id: true, name: true } },
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
    }),
    prisma.warehouseStock.count({ where }),
  ]);
  return { rows, total };
}

export async function getStockRow(warehouseId: string, variantId: string) {
  return prisma.warehouseStock.findUnique({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    include: { variant: { select: { sku: true } } },
  });
}

export async function adjustStock(
  warehouseId: string,
  variantId: string,
  newAvailableQty: number
) {
  return prisma.warehouseStock.update({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    data: { availableQty: newAvailableQty },
  });
}
