/**
 * Orders — repository (Prisma).
 */
import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";
import type { Prisma } from "@prisma/client";

export interface ListOrdersWhere {
  clientId?: string;
  agentId?: string;
  status?: string;
}

export async function getNextOrderNumber(): Promise<string> {
  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('order_number_seq') AS nextval
  `;
  const n = Number(result[0].nextval);
  const year = new Date().getFullYear();
  return `MM-${year}-${String(n).padStart(6, "0")}`;
}

export async function listOrders(
  query: PaginationQuery,
  where: ListOrdersWhere
) {
  const baseWhere: Prisma.OrderWhereInput = { deletedAt: null };
  if (where.clientId) baseWhere.clientId = where.clientId;
  if (where.agentId) baseWhere.agentId = where.agentId;
  if (where.status) baseWhere.status = where.status;

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where: baseWhere,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, fullName: true, email: true } },
        agent: { select: { id: true, fullName: true } },
        lineItems: {
          include: {
            variant: {
              select: {
                id: true,
                sku: true,
                product: { select: { name: true } },
              },
            },
            warehouse: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.order.count({ where: baseWhere }),
  ]);
  return { rows, total };
}

export async function getOrderById(id: string) {
  return prisma.order.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, fullName: true, email: true, clientGroupId: true } },
      agent: { select: { id: true, fullName: true } },
      lineItems: {
        include: {
          variant: {
            select: {
              id: true,
              sku: true,
              unitType: true,
              product: { select: { name: true } },
            },
          },
          warehouse: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function createOrder(data: {
  orderNumber: string;
  clientId: string;
  agentId: string;
  status: string;
  notes?: string | null;
  lineItems: Array<{
    variantId: string;
    warehouseId: string;
    qty: number;
    unitType: string;
    basePrice: number;
    groupDiscount: number;
    finalPrice: number;
  }>;
}) {
  return prisma.order.create({
    data: {
      orderNumber: data.orderNumber,
      clientId: data.clientId,
      agentId: data.agentId,
      status: data.status,
      notes: data.notes ?? null,
      lineItems: {
        create: data.lineItems.map((li) => ({
          variantId: li.variantId,
          warehouseId: li.warehouseId,
          qty: li.qty,
          unitType: li.unitType,
          basePrice: li.basePrice,
          groupDiscount: li.groupDiscount,
          finalPrice: li.finalPrice,
        })),
      },
    },
    include: {
      client: { select: { id: true, fullName: true } },
      agent: { select: { id: true, fullName: true } },
      lineItems: {
        include: {
          variant: {
            select: { id: true, sku: true, product: { select: { name: true } } },
          },
          warehouse: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function updateOrder(
  id: string,
  data: {
    notes?: string | null;
    status?: string;
    currentVersion?: number;
    versionLock?: number;
  }
) {
  return prisma.order.update({
    where: { id },
    data: {
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.currentVersion !== undefined && { currentVersion: data.currentVersion }),
      ...(data.versionLock !== undefined && { versionLock: data.versionLock }),
    },
  });
}

export async function replaceLineItems(
  orderId: string,
  lineItems: Array<{
    variantId: string;
    warehouseId: string;
    qty: number;
    unitType: string;
    basePrice: number;
    groupDiscount: number;
    managerOverride?: number | null;
    finalPrice: number;
  }>
) {
  await prisma.orderLineItem.deleteMany({ where: { orderId } });
  if (lineItems.length > 0) {
    await prisma.orderLineItem.createMany({
      data: lineItems.map((li) => ({
        orderId,
        variantId: li.variantId,
        warehouseId: li.warehouseId,
        qty: li.qty,
        unitType: li.unitType,
        basePrice: li.basePrice,
        groupDiscount: li.groupDiscount,
        managerOverride: li.managerOverride ?? null,
        finalPrice: li.finalPrice,
      })),
    });
  }
}

export async function getOrderWithLock(id: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id, deletedAt: null },
      include: { lineItems: true },
    });
    return order;
  });
}

export async function getOrderVersions(orderId: string) {
  return prisma.orderVersion.findMany({
    where: { orderId },
    orderBy: { versionNumber: "desc" },
    include: { createdByUser: { select: { id: true, fullName: true } } },
  });
}

export async function getOrderVersion(orderId: string, versionNumber: number) {
  return prisma.orderVersion.findUnique({
    where: { orderId_versionNumber: { orderId, versionNumber } },
    include: { createdByUser: { select: { id: true, fullName: true } } },
  });
}

export async function createOrderVersion(data: {
  orderId: string;
  versionNumber: number;
  snapshot: unknown;
  diff?: unknown;
  createdBy: string;
}) {
  return prisma.orderVersion.create({
    data: {
      orderId: data.orderId,
      versionNumber: data.versionNumber,
      snapshot: data.snapshot as Prisma.InputJsonValue,
      ...(data.diff != null && { diff: data.diff as Prisma.InputJsonValue }),
      createdBy: data.createdBy,
    },
  });
}

/** Admin edit approved order in a single transaction: version snapshot + order update + optionally replace line items. */
export async function adminEditApprovedOrderInTransaction(
  orderId: string,
  versionLock: number,
  data: {
    versionNumber: number;
    snapshot: unknown;
    createdBy: string;
    newStatus: string;
    newCurrentVersion: number;
    newVersionLock: number;
    lineItems: Array<{
      variantId: string;
      warehouseId: string;
      qty: number;
      unitType: string;
      basePrice: number;
      groupDiscount: number;
      finalPrice: number;
    }> | null;
  }
) {
  await prisma.$transaction(async (tx) => {
    await tx.orderVersion.create({
      data: {
        orderId,
        versionNumber: data.versionNumber,
        snapshot: data.snapshot as Prisma.InputJsonValue,
        createdBy: data.createdBy,
      },
    });
    const updated = await tx.order.updateMany({
      where: { id: orderId, versionLock },
      data: {
        status: data.newStatus,
        currentVersion: data.newCurrentVersion,
        versionLock: data.newVersionLock,
      },
    });
    if (updated.count !== 1) {
      throw new Error("OPTIMISTIC_LOCK_CONFLICT");
    }
    if (data.lineItems !== null) {
      await tx.orderLineItem.deleteMany({ where: { orderId } });
      if (data.lineItems.length > 0) {
        await tx.orderLineItem.createMany({
          data: data.lineItems.map((li) => ({
            orderId,
            variantId: li.variantId,
            warehouseId: li.warehouseId,
            qty: li.qty,
            unitType: li.unitType,
            basePrice: li.basePrice,
            groupDiscount: li.groupDiscount,
            finalPrice: li.finalPrice,
          })),
        });
      }
    }
  });
}

export async function getLineItem(orderId: string, lineItemId: string) {
  return prisma.orderLineItem.findFirst({
    where: { id: lineItemId, orderId },
    include: { order: true, variant: true },
  });
}

export async function updateLineItemManagerOverride(
  lineItemId: string,
  managerOverride: number
) {
  const item = await prisma.orderLineItem.findUnique({
    where: { id: lineItemId },
    include: { order: true },
  });
  if (!item) return null;
  return prisma.orderLineItem.update({
    where: { id: lineItemId },
    data: { managerOverride, finalPrice: managerOverride },
  });
}

// Stock: lock and check availability, then reserve (approve) or release (cancel) or decrement (fulfill) or add (return)
export async function getStockForVariantWarehouse(
  variantId: string,
  warehouseId: string
) {
  return prisma.warehouseStock.findUnique({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
  });
}

export async function reserveStock(
  variantId: string,
  warehouseId: string,
  qty: number
) {
  return prisma.warehouseStock.update({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    data: { reservedQty: { increment: qty } },
  });
}

export async function releaseReservedStock(
  variantId: string,
  warehouseId: string,
  qty: number
) {
  return prisma.warehouseStock.update({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    data: { reservedQty: { decrement: qty } },
  });
}

export async function decrementStockOnFulfill(
  variantId: string,
  warehouseId: string,
  qty: number
) {
  return prisma.warehouseStock.update({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    data: {
      reservedQty: { decrement: qty },
      availableQty: { decrement: qty },
    },
  });
}

export async function restockOnReturn(
  variantId: string,
  warehouseId: string,
  qty: number
) {
  return prisma.warehouseStock.update({
    where: {
      warehouseId_productVariantId: { warehouseId, productVariantId: variantId },
    },
    data: { availableQty: { increment: qty } },
  });
}

export interface InsufficientStockDetail {
  lineItemId: string;
  variantId: string;
  sku: string;
  requestedQty: number;
  availableQty: number;
  reservedQty: number;
}

/**
 * Approve order in a single transaction: reserve stock (atomic check) + update order.
 * Stock semantics: available_qty = on-hand total; reserved_qty = committed.
 * Free stock = available_qty - reserved_qty. We require (available_qty - reserved_qty) >= qty
 * so we do not over-reserve (e.g. available=10, reserved=8 → only 2 free; order_qty=5 fails).
 */
export async function approveOrderInTransaction(
  orderId: string,
  lineItems: Array<{ id: string; variantId: string; warehouseId: string; qty: number; variant?: { sku: string } | null }>,
  currentVersionLock: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const insufficient: InsufficientStockDetail[] = [];
    for (const li of lineItems) {
      const result = await tx.$executeRaw`
        UPDATE warehouse_stock
        SET reserved_qty = reserved_qty + ${li.qty}
        WHERE warehouse_id = ${li.warehouseId}::uuid
          AND product_variant_id = ${li.variantId}::uuid
          AND (available_qty - reserved_qty) >= ${li.qty}
      `;
      if (result !== 1) {
        const stock = await tx.warehouseStock.findUnique({
          where: {
            warehouseId_productVariantId: { warehouseId: li.warehouseId, productVariantId: li.variantId },
          },
        });
        insufficient.push({
          lineItemId: li.id,
          variantId: li.variantId,
          sku: li.variant?.sku ?? "",
          requestedQty: li.qty,
          availableQty: stock?.availableQty ?? 0,
          reservedQty: stock?.reservedQty ?? 0,
        });
      }
    }
    if (insufficient.length > 0) {
      const err = new Error("INSUFFICIENT_STOCK") as Error & { details?: InsufficientStockDetail[] };
      err.details = insufficient;
      throw err;
    }
    const orderUpdate = await tx.order.updateMany({
      where: { id: orderId, versionLock: currentVersionLock },
      data: { status: "approved", versionLock: currentVersionLock + 1 },
    });
    if (orderUpdate.count !== 1) {
      throw new Error("OPTIMISTIC_LOCK_CONFLICT");
    }
  });
}

/** Fulfill order in a single transaction: decrement reserved + available, update order. */
export async function fulfillOrderInTransaction(
  orderId: string,
  lineItems: Array<{ variantId: string; warehouseId: string; qty: number }>
) {
  return prisma.$transaction(async (tx) => {
    for (const li of lineItems) {
      await tx.warehouseStock.update({
        where: {
          warehouseId_productVariantId: { warehouseId: li.warehouseId, productVariantId: li.variantId },
        },
        data: { reservedQty: { decrement: li.qty }, availableQty: { decrement: li.qty } },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "fulfilled" } });
  });
}

/** Cancel order in a single transaction: release reserved, update order. */
export async function cancelOrderInTransaction(
  orderId: string,
  lineItems: Array<{ variantId: string; warehouseId: string; qty: number }>
) {
  return prisma.$transaction(async (tx) => {
    for (const li of lineItems) {
      await tx.warehouseStock.update({
        where: {
          warehouseId_productVariantId: { warehouseId: li.warehouseId, productVariantId: li.variantId },
        },
        data: { reservedQty: { decrement: li.qty } },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
  });
}

/** Return order in a single transaction: status update only (no stock restore per CTO-DEC-001 / DL-10). */
export async function returnOrderInTransaction(orderId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: "returned" } });
  });
}

export async function countActiveOrdersWithProduct(productId: string) {
  return prisma.order.count({
    where: {
      deletedAt: null,
      status: { notIn: ["draft", "rejected", "cancelled"] },
      lineItems: {
        some: { variant: { productId } },
      },
    },
  });
}

export async function countActiveOrdersWithVariant(variantId: string) {
  return prisma.order.count({
    where: {
      deletedAt: null,
      status: { notIn: ["draft", "rejected", "cancelled"] },
      lineItems: { some: { variantId } },
    },
  });
}
