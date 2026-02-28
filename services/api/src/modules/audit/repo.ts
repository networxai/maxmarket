import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";

export interface ListAuditLogsFilter {
  eventType?: string;
  actorId?: string;
  fromDate?: Date;
  toDate?: Date;
  includeCleared?: boolean;
}

export async function listAuditLogs(query: PaginationQuery, filter: ListAuditLogsFilter) {
  const where: {
    eventType?: string;
    actorId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    clearedAt?: null | { not: null };
  } = {};
  if (filter.eventType) where.eventType = filter.eventType;
  if (filter.actorId) where.actorId = filter.actorId;
  if (filter.fromDate || filter.toDate) {
    where.createdAt = {};
    if (filter.fromDate) where.createdAt.gte = filter.fromDate;
    if (filter.toDate) where.createdAt.lte = filter.toDate;
  }
  if (!filter.includeCleared) where.clearedAt = null;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}
