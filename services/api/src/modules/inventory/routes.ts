import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import { listStockQuerySchema, adjustStockBodySchema } from "./schemas.js";

export async function inventoryRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; warehouseId?: string; variantId?: string };
  }>(
    "/inventory/stock",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = listStockQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const query = parsePaginationQuery(parsed.data.page, parsed.data.pageSize);
      const result = await service.listStock(
        query,
        {
          warehouseId: parsed.data.warehouseId,
          variantId: parsed.data.variantId,
        },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.put<{ Body: unknown }>(
    "/inventory/stock/adjust",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = adjustStockBodySchema.safeParse(request.body);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      await service.adjustStock(
        parsed.data.warehouseId,
        parsed.data.variantId,
        parsed.data.newAvailableQty,
        parsed.data.reason,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );
}
