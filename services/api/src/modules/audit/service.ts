import type { Role } from "../../auth/types.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { clearAuditLog as clearAuditLogCore } from "../../audit/audit-service.js";
import { prisma } from "../../lib/prisma.js";
import * as repo from "./repo.js";

export async function listAuditLogs(
  query: PaginationQuery,
  filter: {
    eventType?: string;
    actorId?: string;
    fromDate?: string;
    toDate?: string;
    includeCleared?: boolean;
  },
  actor: { id: string; role: Role }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const fromDate = filter.fromDate ? new Date(filter.fromDate) : undefined;
  const toDate = filter.toDate ? new Date(filter.toDate) : undefined;
  const { rows, total } = await repo.listAuditLogs(query, {
    eventType: filter.eventType,
    actorId: filter.actorId,
    fromDate,
    toDate,
    includeCleared: filter.includeCleared,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  const actorMap = new Map<string, string>();
  if (actorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, fullName: true },
    });
    for (const u of users) actorMap.set(u.id, u.fullName);
  }
  return {
    data: rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      actorId: r.actorId,
      actorName: r.actorId ? actorMap.get(r.actorId) ?? null : null,
      actorRole: r.actorRole,
      targetType: r.targetType,
      targetId: r.targetId,
      payload: r.payload,
      correlationId: r.correlationId,
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: paginationMeta(total, query),
  };
}

export async function clearAuditLogs(
  body: { scope: "before_date"; beforeDate: string },
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const result = await clearAuditLogCore({
    clearedById: actor.id,
    scope: body.scope,
    beforeDate: body.beforeDate,
    correlationId: opts.correlationId ?? undefined,
  });
  return { clearedCount: result.clearedCount };
}
