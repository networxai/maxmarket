/**
 * API v1 router — mounts all OpenAPI-defined routes under /api/v1
 */
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authRoutes } from "../auth/auth-routes.js";
import { usersRoutes } from "../modules/users/routes.js";
import { clientGroupsRoutes } from "../modules/client-groups/routes.js";
import { catalogRoutes } from "../modules/catalog/routes.js";
import { inventoryRoutes } from "../modules/inventory/routes.js";
import { ordersRoutes } from "../modules/orders/routes.js";
import { auditModuleRoutes } from "../modules/audit/routes.js";
import { i18nRoutes } from "../modules/i18n/routes.js";
import { reportsRoutes } from "../modules/reports/routes.js";
import { AppError } from "../plugins/error-handler.js";
import { ErrorCodes } from "../lib/errors.js";

export async function apiV1Routes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(clientGroupsRoutes);
  await fastify.register(catalogRoutes);
  await fastify.register(inventoryRoutes);
  await fastify.register(ordersRoutes);
  await fastify.register(auditModuleRoutes);
  await fastify.register(i18nRoutes);
  await fastify.register(reportsRoutes);

  // Catch-all 404 for unmatched /api/v1/*
  fastify.setNotFoundHandler(async () => {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Not Found", undefined);
  });
}
