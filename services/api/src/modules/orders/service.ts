/**
 * Orders — service (RBAC, scoping, lifecycle, audit).
 */
import type { Role } from "../../auth/types.js";
import { resolveLang, type Multilingual } from "../../lib/i18n.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { DEFAULT_WAREHOUSE_ID } from "../../lib/constants.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { writeAudit } from "../../audit/audit-service.js";
import { prisma } from "../../lib/prisma.js";
import * as repo from "./repo.js";
import * as usersRepo from "../users/repo.js";

const SUBMITTED = "submitted";
const APPROVED = "approved";
const REJECTED = "rejected";
const FULFILLED = "fulfilled";

export interface OrderScope {
  clientId?: string;
  agentId?: string;
}

function scopeForUser(user: { id: string; role: Role }): OrderScope {
  switch (user.role) {
    case "client":
      return { clientId: user.id };
    case "agent":
      return { agentId: user.id };
    case "manager":
    case "admin":
    case "super_admin":
      return {};
    default:
      return { agentId: user.id };
  }
}

function canAccessOrder(order: { clientId: string; agentId: string }, user: { id: string; role: Role }): boolean {
  if (user.role === "client") return order.clientId === user.id;
  if (user.role === "agent") return order.agentId === user.id;
  return true;
}

function stripAgentIdForClient<T extends { agentId?: string | null; agentName?: string | null }>(obj: T, role: Role): T {
  if (role !== "client") return obj;
  const { agentId: _1, agentName: _2, ...rest } = obj as T & { agentId?: string; agentName?: string };
  return { ...rest } as T;
}

function lineItemsForRole(
  items: Array<{
    id: string;
    variantId: string;
    warehouseId: string;
    qty: number;
    unitType: string;
    basePrice: unknown;
    groupDiscount: unknown;
    managerOverride: unknown;
    finalPrice: unknown;
    variant?: { sku?: string; product?: { name?: unknown } } | null;
    warehouse?: unknown;
  }>,
  role: Role
) {
  return items.map((li) => {
    const productName = li.variant?.product?.name
      ? resolveLang(li.variant.product.name as Multilingual, "en")
      : null;
    const base = {
      id: li.id,
      variantId: li.variantId,
      sku: li.variant?.sku ?? null,
      productName: productName || null,
      warehouseId: li.warehouseId,
      qty: li.qty,
      unitType: li.unitType,
      basePrice: Number(li.basePrice),
      finalPrice: Number(li.finalPrice),
      variant: li.variant,
      warehouse: li.warehouse,
    };
    if (role === "client") {
      const { basePrice: _b, ...clientSafe } = base;
      return clientSafe;
    }
    return {
      ...base,
      groupDiscount: Number(li.groupDiscount),
      managerOverride: li.managerOverride != null ? Number(li.managerOverride) : null,
    };
  });
}

export async function listOrders(
  query: PaginationQuery,
  filter: { status?: string; clientId?: string; agentId?: string },
  user: { id: string; role: Role }
) {
  const scope = scopeForUser(user);
  const where = { ...filter, ...scope };
  const { rows, total } = await repo.listOrders(query, where);
  const data = rows.map((o) => stripAgentIdForClient(
    {
      id: o.id,
      orderNumber: o.orderNumber,
      clientId: o.clientId,
      clientName: o.client?.fullName ?? null,
      agentId: o.agentId,
      agentName: o.agent?.fullName ?? null,
      status: o.status,
      currentVersion: o.currentVersion,
      versionLock: o.versionLock,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      client: o.client,
      agent: o.agent,
      lineItems: lineItemsForRole(o.lineItems, user.role),
    },
    user.role
  ));
  return { data, pagination: paginationMeta(total, query) };
}

export async function getOrderById(
  id: string,
  user: { id: string; role: Role }
) {
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (!canAccessOrder(order, user)) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  return stripAgentIdForClient(
    {
      ...order,
      clientName: order.client?.fullName ?? null,
      agentName: order.agent?.fullName ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lineItems: lineItemsForRole(order.lineItems, user.role),
    },
    user.role
  );
}

export async function createDraft(
  body: { clientId: string; notes?: string; lineItems: Array<{ variantId: string; warehouseId?: string; qty: number }> },
  user: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (user.role !== "agent") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const assigned = await usersRepo.isClientAssignedToAgent(user.id, body.clientId);
  if (!assigned) throw new AppError(403, ErrorCodes.FORBIDDEN, "Client is not assigned to this agent");

  const orderNumber = await repo.getNextOrderNumber();
  const lineItemsWithPrices: Array<{
    variantId: string;
    warehouseId: string;
    qty: number;
    unitType: string;
    basePrice: number;
    groupDiscount: number;
    finalPrice: number;
  }> = [];
  for (const li of body.lineItems) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: li.variantId, deletedAt: null },
    });
    if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, `Variant ${li.variantId} not found`);
    const basePrice = Number(variant.pricePerUnit);
    lineItemsWithPrices.push({
      variantId: li.variantId,
      warehouseId: li.warehouseId ?? DEFAULT_WAREHOUSE_ID,
      qty: li.qty,
      unitType: variant.unitType,
      basePrice,
      groupDiscount: 0,
      finalPrice: basePrice,
    });
  }
  const order = await repo.createOrder({
    orderNumber,
    clientId: body.clientId,
    agentId: user.id,
    status: "draft",
    notes: body.notes ?? null,
    lineItems: lineItemsWithPrices,
  });
  await writeAudit({
    eventType: "orders.created_draft",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: order.id,
    payload: { orderNumber: order.orderNumber, clientId: body.clientId, lineItemCount: body.lineItems.length },
    correlationId: opts.correlationId,
  });
  return stripAgentIdForClient(
    {
      ...order,
      clientName: order.client?.fullName ?? null,
      agentName: order.agent?.fullName ?? null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lineItems: lineItemsForRole(order.lineItems, user.role),
    },
    user.role
  );
}

export async function updateOrder(
  id: string,
  body: { notes?: string; lineItems?: Array<{ variantId: string; warehouseId?: string; qty: number }>; versionLock?: number },
  user: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (!canAccessOrder(order, user)) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");

  if (order.status === SUBMITTED || order.status === REJECTED) {
    throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Order is not editable in current status");
  }

  if (order.status === APPROVED && (user.role === "admin" || user.role === "super_admin")) {
    if (body.versionLock === undefined || body.versionLock !== order.versionLock) {
      throw new AppError(409, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, "Version conflict");
    }
    const snapshot = {
      status: order.status,
      versionLock: order.versionLock,
      lineItems: order.lineItems.map((li) => ({
        id: li.id,
        variantId: li.variantId,
        warehouseId: li.warehouseId,
        qty: li.qty,
        basePrice: Number(li.basePrice),
        groupDiscount: Number(li.groupDiscount),
        managerOverride: li.managerOverride != null ? Number(li.managerOverride) : null,
        finalPrice: Number(li.finalPrice),
      })),
    };
    let lineItemsToReplace: Array<{ variantId: string; warehouseId: string; qty: number; unitType: string; basePrice: number; groupDiscount: number; finalPrice: number }> | null = null;
    if (body.lineItems && body.lineItems.length > 0) {
      lineItemsToReplace = [];
      for (const li of body.lineItems) {
        const variant = await prisma.productVariant.findUnique({ where: { id: li.variantId, deletedAt: null } });
        if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, `Variant ${li.variantId} not found`);
        const basePrice = Number(variant.pricePerUnit);
        const client = await prisma.user.findUnique({ where: { id: order.clientId }, include: { clientGroup: true } });
        let groupDiscount = 0;
        if (client?.clientGroup) {
          const g = client.clientGroup;
          if (g.discountType === "percentage") groupDiscount = basePrice * (Number(g.discountValue) / 100);
          else groupDiscount = Number(g.discountValue);
        }
        lineItemsToReplace.push({
          variantId: li.variantId,
          warehouseId: li.warehouseId ?? DEFAULT_WAREHOUSE_ID,
          qty: li.qty,
          unitType: variant.unitType,
          basePrice,
          groupDiscount,
          finalPrice: basePrice - groupDiscount,
        });
      }
    }
    try {
      await repo.adminEditApprovedOrderInTransaction(id, order.versionLock, {
        versionNumber: order.currentVersion,
        snapshot,
        createdBy: user.id,
        newStatus: SUBMITTED,
        newCurrentVersion: order.currentVersion + 1,
        newVersionLock: order.versionLock + 1,
        lineItems: lineItemsToReplace,
      });
    } catch (e) {
      const err = e as Error;
      if (err.message === "OPTIMISTIC_LOCK_CONFLICT") {
        throw new AppError(409, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, "Version conflict");
      }
      throw e;
    }
    await writeAudit({
      eventType: "orders.admin_version_created",
      actorId: user.id,
      actorRole: user.role,
      targetType: "order",
      targetId: id,
      payload: { previousVersion: order.currentVersion },
      correlationId: opts.correlationId,
    });
    return getOrderById(id, user);
  }

  if (order.status !== "draft") {
    throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Order is not editable");
  }
  if (user.role !== "agent" || order.agentId !== user.id) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  if (body.notes !== undefined) await repo.updateOrder(id, { notes: body.notes });
  if (body.lineItems && body.lineItems.length > 0) {
    const lineItemsWithPrices: Array<{ variantId: string; warehouseId: string; qty: number; unitType: string; basePrice: number; groupDiscount: number; finalPrice: number }> = [];
    for (const li of body.lineItems) {
      const variant = await prisma.productVariant.findUnique({ where: { id: li.variantId, deletedAt: null } });
      if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, `Variant ${li.variantId} not found`);
      const basePrice = Number(variant.pricePerUnit);
      lineItemsWithPrices.push({
        variantId: li.variantId,
        warehouseId: li.warehouseId ?? DEFAULT_WAREHOUSE_ID,
        qty: li.qty,
        unitType: variant.unitType,
        basePrice,
        groupDiscount: 0,
        finalPrice: basePrice,
      });
    }
    await repo.replaceLineItems(id, lineItemsWithPrices);
  }
  await writeAudit({
    eventType: "orders.updated_draft",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function deleteOrder(id: string, user: { id: string; role: Role }) {
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== "draft") throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only draft orders can be deleted");
  if (user.role !== "agent" || order.agentId !== user.id) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  await prisma.order.update({ where: { id }, data: { deletedAt: new Date() } });
  return {};
}

export async function submitOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== "draft") throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only draft orders can be submitted");
  if (user.role !== "agent" || order.agentId !== user.id) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");

  const client = await prisma.user.findUnique({ where: { id: order.clientId }, include: { clientGroup: true } });
  const groupDiscountValue = client?.clientGroup ? Number(client.clientGroup.discountValue) : 0;
  const groupDiscountType = (client?.clientGroup?.discountType as string) ?? "percentage";

  const updatedLineItems: Array<{ variantId: string; warehouseId: string; qty: number; unitType: string; basePrice: number; groupDiscount: number; managerOverride?: number | null; finalPrice: number }> = [];
  for (const li of order.lineItems) {
    const basePrice = Number(li.basePrice);
    let groupDiscount = 0;
    if (groupDiscountType === "percentage") groupDiscount = basePrice * (groupDiscountValue / 100);
    else groupDiscount = groupDiscountValue;
    const finalPrice = li.managerOverride != null ? Number(li.managerOverride) : basePrice - groupDiscount;
    updatedLineItems.push({
      variantId: li.variantId,
      warehouseId: li.warehouseId,
      qty: li.qty,
      unitType: li.unitType,
      basePrice,
      groupDiscount,
      managerOverride: li.managerOverride != null ? Number(li.managerOverride) : null,
      finalPrice,
    });
  }
  await repo.replaceLineItems(id, updatedLineItems);
  await repo.updateOrder(id, { status: SUBMITTED });
  await writeAudit({
    eventType: "orders.submitted",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function approveOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  if (user.role !== "manager") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== SUBMITTED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only submitted orders can be approved");

  try {
    await repo.approveOrderInTransaction(
      id,
      order.lineItems.map((li) => ({
        id: li.id,
        variantId: li.variantId,
        warehouseId: li.warehouseId,
        qty: li.qty,
        variant: li.variant,
      })),
      order.versionLock
    );
  } catch (e) {
    const err = e as Error & { details?: repo.InsufficientStockDetail[] };
    if (err.message === "INSUFFICIENT_STOCK" && err.details) {
      throw new AppError(422, ErrorCodes.INSUFFICIENT_STOCK, "Insufficient stock", err.details);
    }
    if (err.message === "OPTIMISTIC_LOCK_CONFLICT") {
      throw new AppError(409, ErrorCodes.OPTIMISTIC_LOCK_CONFLICT, "Version conflict");
    }
    throw e;
  }
  await writeAudit({
    eventType: "orders.approved",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: { lineItems: order.lineItems.map((li) => ({ variantId: li.variantId, warehouseId: li.warehouseId, qty: li.qty })) },
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function rejectOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  if (user.role !== "manager") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== SUBMITTED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only submitted orders can be rejected");
  await repo.updateOrder(id, { status: REJECTED });
  await writeAudit({
    eventType: "orders.rejected",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function fulfillOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  if (user.role !== "manager") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== APPROVED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only approved orders can be fulfilled");
  await repo.fulfillOrderInTransaction(
    id,
    order.lineItems.map((li) => ({ variantId: li.variantId, warehouseId: li.warehouseId, qty: li.qty }))
  );
  await writeAudit({
    eventType: "orders.fulfilled",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function cancelOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  if (user.role !== "super_admin" && user.role !== "admin" && user.role !== "manager") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== APPROVED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only approved orders can be cancelled");
  await repo.cancelOrderInTransaction(
    id,
    order.lineItems.map((li) => ({ variantId: li.variantId, warehouseId: li.warehouseId, qty: li.qty }))
  );
  await writeAudit({
    eventType: "orders.cancelled",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function returnOrder(id: string, user: { id: string; role: Role }, opts: { correlationId?: string }) {
  if (user.role !== "super_admin" && user.role !== "admin" && user.role !== "manager") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const order = await repo.getOrderById(id);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (order.status !== FULFILLED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Only fulfilled orders can be returned");
  await repo.returnOrderInTransaction(id);
  await writeAudit({
    eventType: "orders.returned",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order",
    targetId: id,
    payload: {},
    correlationId: opts.correlationId,
  });
  return getOrderById(id, user);
}

export async function getOrderVersions(orderId: string, user: { id: string; role: Role }) {
  const order = await repo.getOrderById(orderId);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (!canAccessOrder(order, user)) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  if (user.role === "client" || user.role === "agent") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const versions = await repo.getOrderVersions(orderId);
  return versions.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  }));
}

export async function getOrderVersionByNumber(orderId: string, versionNumber: number, user: { id: string; role: Role }) {
  const order = await repo.getOrderById(orderId);
  if (!order) throw new AppError(404, ErrorCodes.NOT_FOUND, "Order not found");
  if (!canAccessOrder(order, user)) throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  if (user.role === "client" || user.role === "agent") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const v = await repo.getOrderVersion(orderId, versionNumber);
  if (!v) throw new AppError(404, ErrorCodes.NOT_FOUND, "Version not found");
  return { ...v, createdAt: v.createdAt.toISOString() };
}

export async function overrideLineItemPrice(
  orderId: string,
  lineItemId: string,
  managerOverride: number,
  user: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (user.role !== "manager") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  const lineItem = await repo.getLineItem(orderId, lineItemId);
  if (!lineItem) throw new AppError(404, ErrorCodes.NOT_FOUND, "Line item not found");
  if (lineItem.order.status !== SUBMITTED) throw new AppError(422, ErrorCodes.ORDER_NOT_EDITABLE, "Price override only allowed for submitted orders");
  await repo.updateLineItemManagerOverride(lineItemId, managerOverride);
  await writeAudit({
    eventType: "orders.price_overridden",
    actorId: user.id,
    actorRole: user.role,
    targetType: "order_line_item",
    targetId: lineItemId,
    payload: { orderId, managerOverride },
    correlationId: opts.correlationId,
  });
  return getOrderById(orderId, user);
}
