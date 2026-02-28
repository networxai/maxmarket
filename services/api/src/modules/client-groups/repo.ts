import { prisma } from "../../lib/prisma.js";
import type { PaginationQuery } from "../../lib/pagination.js";
import { skipTake } from "../../lib/pagination.js";

export async function listClientGroups(query: PaginationQuery) {
  const where = { deletedAt: null };
  const [rows, total] = await Promise.all([
    prisma.clientGroup.findMany({
      where,
      ...skipTake(query),
      orderBy: { name: "asc" },
    }),
    prisma.clientGroup.count({ where }),
  ]);
  return { rows, total };
}

export async function getClientGroupById(id: string) {
  return prisma.clientGroup.findFirst({
    where: { id, deletedAt: null },
  });
}

export async function getClientGroupByName(name: string) {
  return prisma.clientGroup.findFirst({
    where: { name, deletedAt: null },
  });
}

export async function createClientGroup(data: {
  name: string;
  discountType: string;
  discountValue: number;
}) {
  return prisma.clientGroup.create({
    data: {
      name: data.name,
      discountType: data.discountType,
      discountValue: data.discountValue,
    },
  });
}

export async function updateClientGroup(
  id: string,
  data: { name?: string; discountType?: string; discountValue?: number }
) {
  return prisma.clientGroup.update({
    where: { id },
    data: {
      ...(data.name != null && { name: data.name }),
      ...(data.discountType != null && { discountType: data.discountType }),
      ...(data.discountValue != null && { discountValue: data.discountValue }),
    },
  });
}

export async function deleteClientGroup(id: string) {
  return prisma.clientGroup.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function countUsersInGroup(groupId: string): Promise<number> {
  return prisma.user.count({
    where: { clientGroupId: groupId, deletedAt: null },
  });
}
