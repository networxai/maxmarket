import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import { listAuditLogsQuerySchema, clearAuditLogsBodySchema } from "./schemas.js";

export async function auditModuleRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{
    Querystring: {
      page?: string;
      pageSize?: string;
      eventType?: string;
      actorId?: string;
      fromDate?: string;
      toDate?: string;
      includeCleared?: string;
    };
  }>(
    "/audit/logs",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = listAuditLogsQuerySchema.safeParse(request.query);
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
      const result = await service.listAuditLogs(
        query,
        {
          eventType: parsed.data.eventType,
          actorId: parsed.data.actorId,
          fromDate: parsed.data.fromDate,
          toDate: parsed.data.toDate,
          includeCleared: parsed.data.includeCleared,
        },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.post<{ Body: unknown }>(
    "/audit/logs/clear",
    { preHandler: [authMiddleware, requireRoles("super_admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = clearAuditLogsBodySchema.safeParse(request.body);
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
      const result = await service.clearAuditLogs(parsed.data, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );
}
