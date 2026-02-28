/**
 * Audit logging — write to audit.audit_log (append-only).
 * Event types must match contracts/events.json.
 * Audit "clear" = soft delete (cleared_at) + write audit.logs_cleared first.
 */
import { prisma } from "../lib/prisma.js";

export interface WriteAuditParams {
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload: Record<string, unknown>;
  ipAddress?: string | null;
  correlationId?: string | null;
}

export async function writeAudit(params: WriteAuditParams): Promise<void> {
  const {
    eventType,
    actorId,
    actorRole,
    targetType,
    targetId,
    payload,
    ipAddress,
    correlationId,
  } = params;

  await prisma.auditLog.create({
    data: {
      eventType,
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      payload: payload as object,
      ipAddress: ipAddress ?? null,
      correlationId: correlationId ?? null,
    },
  });
}

/** Clear audit: write audit.logs_cleared first, then set cleared_at on batch (soft delete). */
export interface ClearAuditParams {
  clearedById: string;
  scope: "before_date";
  beforeDate: string;
  correlationId?: string | null;
}

export async function clearAuditLog(params: ClearAuditParams): Promise<{ clearedCount: number }> {
  const { clearedById, beforeDate, scope, correlationId } = params;
  const before = new Date(beforeDate);

  const toClear = await prisma.auditLog.findMany({
    where: { createdAt: { lt: before }, clearedAt: null },
    select: { id: true },
  });
  const clearedCount = toClear.length;

  await writeAudit({
    eventType: "audit.logs_cleared",
    actorId: clearedById,
    payload: { clearedById, scope, beforeDate, clearedCount },
    correlationId,
  });

  if (clearedCount > 0) {
    await prisma.auditLog.updateMany({
      where: { id: { in: toClear.map((r) => r.id) } },
      data: { clearedAt: new Date() },
    });
  }

  return { clearedCount };
}
