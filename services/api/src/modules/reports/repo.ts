import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolveLang, type Multilingual } from "../../lib/i18n.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";

const FULFILLED = "fulfilled";

export interface ReportScope {
  clientIds?: string[];
}

function buildOrderWhere(
  scope?: ReportScope,
  dateFilter?: { fromDate?: Date; toDate?: Date }
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {
    status: FULFILLED,
    deletedAt: null,
  };
  if (scope?.clientIds && scope.clientIds.length > 0) {
    where.clientId = { in: scope.clientIds };
  }
  if (dateFilter?.fromDate || dateFilter?.toDate) {
    where.createdAt = {};
    if (dateFilter.fromDate) where.createdAt.gte = dateFilter.fromDate;
    if (dateFilter.toDate) where.createdAt.lte = dateFilter.toDate;
  }
  return where;
}

export async function salesByDate(
  query: PaginationQuery,
  filter: { fromDate?: Date; toDate?: Date },
  scope?: ReportScope
) {
  const where = buildOrderWhere(scope, filter);
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      lineItems: {
        select: {
          qty: true,
          finalPrice: true,
        },
      },
    },
  });
  const byDate = new Map<string, { date: string; revenue: number; orderCount: number; totalQty: number }>();
  for (const o of orders) {
    const date = o.createdAt.toISOString().slice(0, 10);
    const revenue = o.lineItems.reduce((s, li) => s + Number(li.finalPrice) * li.qty, 0);
    const totalQty = o.lineItems.reduce((s, li) => s + li.qty, 0);
    const existing = byDate.get(date);
    if (existing) {
      existing.revenue += revenue;
      existing.orderCount += 1;
      existing.totalQty += totalQty;
    } else {
      byDate.set(date, { date, revenue, orderCount: 1, totalQty });
    }
  }
  const rows = Array.from(byDate.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      dimension: r.date,
      dimensionLabel: r.date,
      orderCount: r.orderCount,
      totalQty: r.totalQty,
      totalRevenue: Number(r.revenue) || 0,
    }));
  const total = rows.length;
  const { skip, take } = skipTake(query);
  return { rows: rows.slice(skip, skip + take), total };
}

export async function salesByManager(
  query: PaginationQuery,
  filter: { fromDate?: Date; toDate?: Date },
  scope?: ReportScope
) {
  const where = buildOrderWhere(scope, filter);
  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      lineItems: { select: { qty: true, finalPrice: true } },
    },
  });
  const orderIds = orders.map((o) => o.id);
  const approveEvents = await prisma.auditLog.findMany({
    where: {
      eventType: "orders.approved",
      targetType: "order",
      targetId: { in: orderIds },
      clearedAt: null,
      actorId: { not: null },
    },
    select: { targetId: true, actorId: true },
  });
  const orderIdToManagerId = new Map<string, string>();
  for (const e of approveEvents) {
    if (e.targetId && e.actorId) {
      orderIdToManagerId.set(e.targetId, e.actorId);
    }
  }
  const managerIds = [...new Set(orderIdToManagerId.values())];
  const managers = await prisma.user.findMany({
    where: { id: { in: managerIds } },
    select: { id: true, fullName: true },
  });
  const managerMap = new Map(managers.map((m) => [m.id, m.fullName]));

  const byManager = new Map<
    string,
    { managerId: string; managerName: string; revenue: number; orderCount: number }
  >();
  for (const o of orders) {
    const managerId = orderIdToManagerId.get(o.id);
    if (!managerId) continue;
    const managerName = managerMap.get(managerId) ?? "Unknown";
    const revenue = o.lineItems.reduce((s, li) => s + Number(li.finalPrice) * li.qty, 0);
    const existing = byManager.get(managerId);
    if (existing) {
      existing.revenue += revenue;
      existing.orderCount += 1;
    } else {
      byManager.set(managerId, {
        managerId,
        managerName,
        revenue,
        orderCount: 1,
      });
    }
  }
  const rows = Array.from(byManager.values()).map((r) => ({
    managerId: r.managerId,
    managerName: r.managerName,
    orderCount: r.orderCount,
    totalRevenue: Number(r.revenue) || 0,
  }));
  const total = rows.length;
  const { skip, take } = skipTake(query);
  return { rows: rows.slice(skip, skip + take), total };
}

export async function salesByClient(
  query: PaginationQuery,
  filter: { clientId?: string; fromDate?: Date; toDate?: Date },
  scope?: ReportScope
) {
  const where = buildOrderWhere(scope, { fromDate: filter.fromDate, toDate: filter.toDate });
  if (filter.clientId) (where as { clientId?: string }).clientId = filter.clientId;
  const orders = await prisma.order.findMany({
    where,
    include: {
      client: { select: { id: true, fullName: true } },
      lineItems: { select: { qty: true, finalPrice: true } },
    },
  });
  const byClient = new Map<
    string,
    { clientId: string; clientName: string; revenue: number; orderCount: number; totalQty: number }
  >();
  for (const o of orders) {
    const revenue = o.lineItems.reduce((s, li) => s + Number(li.finalPrice) * li.qty, 0);
    const totalQty = o.lineItems.reduce((s, li) => s + li.qty, 0);
    const existing = byClient.get(o.clientId);
    if (existing) {
      existing.revenue += revenue;
      existing.orderCount += 1;
      existing.totalQty += totalQty;
    } else {
      byClient.set(o.clientId, {
        clientId: o.clientId,
        clientName: o.client.fullName,
        revenue,
        orderCount: 1,
        totalQty,
      });
    }
  }
  const rows = Array.from(byClient.values()).map((r) => ({
    dimension: r.clientId,
    dimensionLabel: r.clientName,
    orderCount: r.orderCount,
    totalQty: r.totalQty,
    totalRevenue: Number(r.revenue) || 0,
  }));
  const total = rows.length;
  const { skip, take } = skipTake(query);
  return { rows: rows.slice(skip, skip + take), total };
}

export async function salesByProduct(
  query: PaginationQuery,
  filter: { variantId?: string; fromDate?: Date; toDate?: Date },
  scope?: ReportScope
) {
  const where = buildOrderWhere(scope, { fromDate: filter.fromDate, toDate: filter.toDate });
  const lineItems = await prisma.orderLineItem.findMany({
    where: {
      order: where,
      ...(filter.variantId && { variantId: filter.variantId }),
    },
    include: {
      variant: {
        select: { id: true, sku: true, product: { select: { name: true } } },
      },
    },
  });
  const byVariant = new Map<
    string,
    { variantId: string; sku: string; productName: string | null; revenue: number; totalQty: number; orderIds: Set<string> }
  >();
  for (const li of lineItems) {
    const revenue = Number(li.finalPrice) * li.qty;
    const productName = li.variant.product?.name
      ? resolveLang(li.variant.product.name as Multilingual, "en") || null
      : null;
    const existing = byVariant.get(li.variantId);
    if (existing) {
      existing.revenue += revenue;
      existing.totalQty += li.qty;
      existing.orderIds.add(li.orderId);
    } else {
      const orderIds = new Set<string>([li.orderId]);
      byVariant.set(li.variantId, {
        variantId: li.variantId,
        sku: li.variant.sku,
        productName,
        revenue,
        totalQty: li.qty,
        orderIds,
      });
    }
  }
  const rows = Array.from(byVariant.values()).map((r) => {
    const dimensionLabel = r.productName
      ? `${r.productName} (${r.sku})`
      : r.sku;
    return {
      dimension: r.variantId,
      dimensionLabel,
      orderCount: r.orderIds.size,
      totalQty: r.totalQty,
      totalRevenue: Number(r.revenue) || 0,
      variantId: r.variantId,
      sku: r.sku,
      productName: r.productName,
    };
  });
  const total = rows.length;
  const { skip, take } = skipTake(query);
  return { rows: rows.slice(skip, skip + take), total };
}
