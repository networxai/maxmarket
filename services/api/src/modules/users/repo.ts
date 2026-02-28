/**
 * Users — repository (Prisma).
 */
import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";

const ROLES = ["super_admin", "admin", "manager", "agent", "client"] as const;

export interface ListUsersFilter {
  role?: (typeof ROLES)[number];
  isActive?: boolean;
}

export async function listUsers(
  query: PaginationQuery,
  filter: ListUsersFilter
) {
  const where: { deletedAt: null; role?: string; isActive?: boolean } = {
    deletedAt: null,
  };
  if (filter.role) where.role = filter.role;
  if (filter.isActive !== undefined) where.isActive = filter.isActive;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      include: { clientGroup: { select: { id: true, name: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
}

export async function getUserById(id: string) {
  return prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: { clientGroup: { select: { id: true, name: true } } },
  });
}

export async function getUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  role: string;
  preferredLanguage: string;
  clientGroupId?: string | null;
}) {
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      role: data.role,
      preferredLanguage: data.preferredLanguage,
      clientGroupId: data.clientGroupId ?? null,
    },
    include: { clientGroup: { select: { id: true, name: true } } },
  });
}

export async function updateUser(
  id: string,
  data: {
    fullName?: string;
    preferredLanguage?: string;
    role?: string;
    isActive?: boolean;
    clientGroupId?: string | null;
  }
) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.fullName != null && { fullName: data.fullName }),
      ...(data.preferredLanguage != null && { preferredLanguage: data.preferredLanguage }),
      ...(data.role != null && { role: data.role }),
      ...(data.isActive != null && { isActive: data.isActive }),
      ...(data.clientGroupId !== undefined && { clientGroupId: data.clientGroupId }),
    },
    include: { clientGroup: { select: { id: true, name: true } } },
  });
}

export async function deactivateUser(id: string) {
  return prisma.user.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
    include: { clientGroup: { select: { id: true, name: true } } },
  });
}

export async function getAgentClients(agentId: string, query: PaginationQuery) {
  const { skip, take } = skipTake(query);
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        clientAssignments: { some: { agentId } },
      },
      skip,
      take,
      orderBy: { fullName: "asc" },
      include: { clientGroup: { select: { id: true, name: true } } },
    }),
    prisma.user.count({
      where: {
        deletedAt: null,
        clientAssignments: { some: { agentId } },
      },
    }),
  ]);
  return { rows, total };
}

export async function assignClientToAgent(agentId: string, clientId: string) {
  return prisma.agentClientAssignment.create({
    data: { agentId, clientId },
  });
}

export async function removeClientFromAgent(agentId: string, clientId: string) {
  return prisma.agentClientAssignment.deleteMany({
    where: { agentId, clientId },
  });
}

export async function isClientAssignedToAgent(
  agentId: string,
  clientId: string
): Promise<boolean> {
  const r = await prisma.agentClientAssignment.findUnique({
    where: { agentId_clientId: { agentId, clientId } },
  });
  return r != null;
}
