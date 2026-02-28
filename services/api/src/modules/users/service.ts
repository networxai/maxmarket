/**
 * Users — business logic, scoping, audit.
 */
import type { Role } from "../../auth/types.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { writeAudit } from "../../audit/audit-service.js";
import { hashPassword } from "../../auth/auth-service.js";
import * as repo from "./repo.js";
import type { CreateUserBody, UpdateUserBody } from "./schemas.js";

function toUserResponse(row: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  preferredLanguage: string;
  isActive: boolean;
  clientGroupId: string | null;
  createdAt: Date;
  clientGroup?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    preferredLanguage: row.preferredLanguage,
    isActive: row.isActive,
    clientGroupId: row.clientGroupId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUsers(
  query: PaginationQuery,
  filter: { role?: Role; isActive?: boolean },
  _actor: { id: string; role: Role }
) {
  const { rows, total } = await repo.listUsers(query, filter);
  return {
    data: rows.map(toUserResponse),
    pagination: paginationMeta(total, query),
  };
}

export async function getUserById(
  id: string,
  actor: { id: string; role: Role }
) {
  const user = await repo.getUserById(id);
  if (!user) throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");
  if (actor.role !== "super_admin" && actor.role !== "admin" && actor.id !== id) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  return toUserResponse(user);
}

export async function createUser(
  body: CreateUserBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const existing = await repo.getUserByEmail(body.email);
  if (existing) {
    throw new AppError(409, ErrorCodes.CONFLICT, "Email already in use");
  }
  const passwordHash = await hashPassword(body.password);
  const user = await repo.createUser({
    email: body.email,
    passwordHash,
    fullName: body.fullName,
    role: body.role,
    preferredLanguage: body.preferredLanguage,
    clientGroupId: body.role === "client" ? body.clientGroupId ?? null : null,
  });
  await writeAudit({
    eventType: "user.created",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "user",
    targetId: user.id,
    payload: { email: user.email, role: user.role },
    correlationId: opts.correlationId,
  });
  return toUserResponse(user);
}

export async function updateUser(
  id: string,
  body: UpdateUserBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  const user = await repo.getUserById(id);
  if (!user) throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");

  const isOwnProfile = actor.id === id;
  const isSuperAdmin = actor.role === "super_admin";

  if (!isSuperAdmin && !isOwnProfile) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  if (isOwnProfile && !isSuperAdmin) {
    if (
      body.role !== undefined ||
      body.isActive !== undefined ||
      body.clientGroupId !== undefined
    ) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
    }
    if (body.fullName === undefined && body.preferredLanguage === undefined) {
      return toUserResponse(user);
    }
  }

  const oldRole = user.role;
  const userUpdated = await repo.updateUser(id, {
    fullName: body.fullName,
    preferredLanguage: body.preferredLanguage,
    role: body.role,
    isActive: body.isActive,
    clientGroupId: body.clientGroupId,
  });

  if (body.role != null && body.role !== oldRole) {
    await writeAudit({
      eventType: "user.role_changed",
      actorId: actor.id,
      actorRole: actor.role,
      targetType: "user",
      targetId: id,
      payload: { targetUserId: id, changedById: actor.id, oldRole, newRole: body.role },
      correlationId: opts.correlationId,
    });
  }
  await writeAudit({
    eventType: "user.updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "user",
    targetId: id,
    payload: { updatedFields: Object.keys(body) },
    correlationId: opts.correlationId,
  });
  return toUserResponse(userUpdated);
}

export async function deactivateUser(
  id: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const user = await repo.getUserById(id);
  if (!user) throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");
  await repo.deactivateUser(id);
  await writeAudit({
    eventType: "user.deactivated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "user",
    targetId: id,
    payload: { targetUserId: id, deactivatedById: actor.id },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function getAgentClients(
  agentId: string,
  query: PaginationQuery,
  actor: { id: string; role: Role }
) {
  if (
    actor.role !== "super_admin" &&
    actor.role !== "admin" &&
    actor.role !== "manager" &&
    (actor.role !== "agent" || actor.id !== agentId)
  ) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const { rows, total } = await repo.getAgentClients(agentId, query);
  return {
    data: rows.map(toUserResponse),
    pagination: paginationMeta(total, query),
  };
}

export async function assignClientToAgent(
  agentId: string,
  clientId: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const [agent, client] = await Promise.all([
    repo.getUserById(agentId),
    repo.getUserById(clientId),
  ]);
  if (!agent) throw new AppError(404, ErrorCodes.NOT_FOUND, "Agent not found");
  if (!client) throw new AppError(404, ErrorCodes.NOT_FOUND, "Client not found");
  if (agent.role !== "agent") {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "User must have role agent");
  }
  if (client.role !== "client") {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "User must have role client");
  }
  if (!client.isActive) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Client is not active");
  }
  const already = await repo.isClientAssignedToAgent(agentId, clientId);
  if (already) {
    throw new AppError(409, ErrorCodes.CONFLICT, "Client already assigned to agent");
  }
  await repo.assignClientToAgent(agentId, clientId);
  await writeAudit({
    eventType: "user.client_assigned",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "user",
    targetId: clientId,
    payload: { agentId, clientId },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function removeClientFromAgent(
  agentId: string,
  clientId: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const result = await repo.removeClientFromAgent(agentId, clientId);
  if (result.count > 0) {
    await writeAudit({
      eventType: "user.client_unassigned",
      actorId: actor.id,
      actorRole: actor.role,
      targetType: "user",
      targetId: clientId,
      payload: { agentId, clientId },
      correlationId: opts.correlationId,
    });
  }
  return {};
}
