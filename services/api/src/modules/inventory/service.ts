import type { Role } from "../../auth/types.js";
import { resolveLang, type Multilingual } from "../../lib/i18n.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { writeAudit } from "../../audit/audit-service.js";
import * as repo from "./repo.js";

export async function listStock(
  query: PaginationQuery,
  filter: { warehouseId?: string; variantId?: string },
  actor: { id: string; role: Role }
) {
  if (actor.role === "client") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const { rows, total } = await repo.listStock(query, filter);
  return {
    data: rows.map((r) => {
      const productName = r.variant.product?.name
        ? resolveLang(r.variant.product.name as Multilingual, "en")
        : null;
      return {
        variantId: r.productVariantId,
        sku: r.variant.sku,
        productName: productName || null,
        warehouseId: r.warehouseId,
        availableQty: r.availableQty,
        reservedQty: r.reservedQty,
      };
    }),
    pagination: paginationMeta(total, query),
  };
}

export async function adjustStock(
  warehouseId: string,
  variantId: string,
  newAvailableQty: number,
  reason: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const row = await repo.getStockRow(warehouseId, variantId);
  if (!row) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Stock row not found");
  }
  const reservedQty = row.reservedQty;
  if (newAvailableQty < reservedQty) {
    throw new AppError(422, ErrorCodes.STOCK_BELOW_RESERVED, "available_qty cannot be set below reserved_qty", {
      requestedAvailableQty: newAvailableQty,
      currentReservedQty: reservedQty,
    });
  }
  const oldAvailableQty = row.availableQty;
  await repo.adjustStock(warehouseId, variantId, newAvailableQty);
  await writeAudit({
    eventType: "stock.adjusted",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "warehouse_stock",
    targetId: row.id,
    payload: {
      warehouseId,
      variantId,
      adminId: actor.id,
      oldAvailableQty,
      newAvailableQty,
      reservedQty,
      reason,
    },
    correlationId: opts.correlationId,
  });
  return {};
}
