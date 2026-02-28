import type { Role } from "../../auth/types.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { writeAudit } from "../../audit/audit-service.js";
import * as repo from "./repo.js";
import type { CreateClientGroupBody, UpdateClientGroupBody } from "./schemas.js";

function toResponse(row: {
  id: string;
  name: string;
  discountType: string;
  discountValue: { toNumber: () => number };
}) {
  return {
    id: row.id,
    name: row.name,
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
  };
}

export async function listClientGroups(
  query: PaginationQuery,
  actor: { id: string; role: Role }
) {
  if (actor.role === "client") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const { rows, total } = await repo.listClientGroups(query);
  return {
    data: rows.map(toResponse),
    pagination: paginationMeta(total, query),
  };
}

export async function getClientGroupById(
  id: string,
  actor: { id: string; role: Role }
) {
  if (actor.role === "client") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const group = await repo.getClientGroupById(id);
  if (!group) throw new AppError(404, ErrorCodes.NOT_FOUND, "Client group not found");
  return toResponse(group);
}

export async function createClientGroup(
  body: CreateClientGroupBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const existing = await repo.getClientGroupByName(body.name);
  if (existing) {
    throw new AppError(409, ErrorCodes.CONFLICT, "Client group name already in use");
  }
  const group = await repo.createClientGroup({
    name: body.name,
    discountType: body.discountType,
    discountValue: body.discountValue,
  });
  await writeAudit({
    eventType: "client_group.created",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "client_group",
    targetId: group.id,
    payload: { groupId: group.id, name: group.name },
    correlationId: opts.correlationId,
  });
  return toResponse(group);
}

export async function updateClientGroup(
  id: string,
  body: UpdateClientGroupBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const group = await repo.getClientGroupById(id);
  if (!group) throw new AppError(404, ErrorCodes.NOT_FOUND, "Client group not found");
  const updated = await repo.updateClientGroup(id, body);
  await writeAudit({
    eventType: "client_group.updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "client_group",
    targetId: id,
    payload: {
      groupId: id,
      adminId: actor.id,
      oldDiscountType: group.discountType,
      oldDiscountValue: Number(group.discountValue),
      newDiscountType: updated.discountType,
      newDiscountValue: Number(updated.discountValue),
    },
    correlationId: opts.correlationId,
  });
  return toResponse(updated);
}

export async function deleteClientGroup(
  id: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const group = await repo.getClientGroupById(id);
  if (!group) throw new AppError(404, ErrorCodes.NOT_FOUND, "Client group not found");
  const count = await repo.countUsersInGroup(id);
  if (count > 0) {
    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      "Cannot delete: clients are assigned to this group"
    );
  }
  await repo.deleteClientGroup(id);
  await writeAudit({
    eventType: "client_group.deleted",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "client_group",
    targetId: id,
    payload: { groupId: id },
    correlationId: opts.correlationId,
  });
  return {};
}
