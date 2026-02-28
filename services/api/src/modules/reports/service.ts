import type { Role } from "../../auth/types.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { writeAudit } from "../../audit/audit-service.js";
import { prisma } from "../../lib/prisma.js";
import * as repo from "./repo.js";

async function getAgentClientIds(agentId: string): Promise<string[]> {
  const rows = await prisma.agentClientAssignment.findMany({
    where: { agentId },
    select: { clientId: true },
  });
  return rows.map((r) => r.clientId);
}

export async function salesByDate(
  query: PaginationQuery,
  filter: { fromDate?: string; toDate?: string },
  user: { id: string; role: Role }
) {
  if (user.role === "client") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  let scope: repo.ReportScope | undefined;
  if (user.role === "agent") {
    const clientIds = await getAgentClientIds(user.id);
    scope = clientIds.length > 0 ? { clientIds } : { clientIds: [] };
  }
  const fromDate = filter.fromDate ? new Date(filter.fromDate) : undefined;
  const toDate = filter.toDate ? new Date(filter.toDate) : undefined;
  const { rows, total } = await repo.salesByDate(query, { fromDate, toDate }, scope);
  return { data: rows, pagination: paginationMeta(total, query) };
}

export async function salesByManager(
  query: PaginationQuery,
  filter: { fromDate?: string; toDate?: string },
  user: { id: string; role: Role }
) {
  if (user.role !== "super_admin" && user.role !== "admin" && user.role !== "manager") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const fromDate = filter.fromDate ? new Date(filter.fromDate) : undefined;
  const toDate = filter.toDate ? new Date(filter.toDate) : undefined;
  const { rows, total } = await repo.salesByManager(query, { fromDate, toDate }, undefined);
  return { data: rows, pagination: paginationMeta(total, query) };
}

export async function salesByClient(
  query: PaginationQuery,
  filter: { clientId?: string; fromDate?: string; toDate?: string },
  user: { id: string; role: Role }
) {
  if (user.role === "client") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  let scope: repo.ReportScope | undefined;
  if (user.role === "agent") {
    const clientIds = await getAgentClientIds(user.id);
    scope = clientIds.length > 0 ? { clientIds } : { clientIds: [] };
    if (filter.clientId && !clientIds.includes(filter.clientId)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
    }
  }
  const fromDate = filter.fromDate ? new Date(filter.fromDate) : undefined;
  const toDate = filter.toDate ? new Date(filter.toDate) : undefined;
  const { rows, total } = await repo.salesByClient(
    query,
    { clientId: filter.clientId, fromDate, toDate },
    scope
  );
  return { data: rows, pagination: paginationMeta(total, query) };
}

export async function salesByProduct(
  query: PaginationQuery,
  filter: { variantId?: string; fromDate?: string; toDate?: string },
  user: { id: string; role: Role }
) {
  if (user.role === "client") throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  let scope: repo.ReportScope | undefined;
  if (user.role === "agent") {
    const clientIds = await getAgentClientIds(user.id);
    scope = clientIds.length > 0 ? { clientIds } : { clientIds: [] };
  }
  const fromDate = filter.fromDate ? new Date(filter.fromDate) : undefined;
  const toDate = filter.toDate ? new Date(filter.toDate) : undefined;
  const { rows, total } = await repo.salesByProduct(
    query,
    { variantId: filter.variantId, fromDate, toDate },
    scope
  );
  return { data: rows, pagination: paginationMeta(total, query) };
}

export async function exportReport(
  reportType: string,
  format: string,
  filter: { fromDate?: string; toDate?: string; clientId?: string; variantId?: string },
  user: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  await writeAudit({
    eventType: "reports.exported",
    actorId: user.id,
    actorRole: user.role,
    targetType: "report",
    targetId: null,
    payload: { reportType, format, filters: filter },
    correlationId: opts.correlationId ?? undefined,
  });
  const query = { page: 1, pageSize: 10000 };
  let data: unknown;
  if (reportType === "sales-by-date") {
    const r = await salesByDate(query, { fromDate: filter.fromDate, toDate: filter.toDate }, user);
    data = r.data;
  } else if (reportType === "sales-by-manager") {
    const r = await salesByManager(query, { fromDate: filter.fromDate, toDate: filter.toDate }, user);
    data = r.data;
  } else if (reportType === "sales-by-client") {
    const r = await salesByClient(query, { clientId: filter.clientId, fromDate: filter.fromDate, toDate: filter.toDate }, user);
    data = r.data;
  } else if (reportType === "sales-by-product") {
    const r = await salesByProduct(query, { variantId: filter.variantId, fromDate: filter.fromDate, toDate: filter.toDate }, user);
    data = r.data;
  } else {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Report type not found");
  }
  if (format === "csv") {
    const rows = Array.isArray(data) ? data : [];
    const headers = rows.length > 0 ? Object.keys(rows[0] as object) : [];
    const csv = [headers.join(","), ...rows.map((r) => Object.values(r as object).join(","))].join("\n");
    return { format: "csv", content: csv };
  }
  if (format === "pdf") {
    throw new AppError(501, ErrorCodes.NOT_IMPLEMENTED, "PDF export not implemented");
  }
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, "Unsupported format");
}
