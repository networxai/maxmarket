import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import {
  listClientGroupsQuerySchema,
  createClientGroupBodySchema,
  updateClientGroupBodySchema,
  clientGroupIdParamSchema,
} from "./schemas.js";

export async function clientGroupsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{ Querystring: { page?: string; pageSize?: string } }>(
    "/client-groups",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = listClientGroupsQuerySchema.safeParse({
        page: request.query?.page,
        pageSize: request.query?.pageSize,
      });
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
      const result = await service.listClientGroups(query, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.post<{ Body: unknown }>(
    "/client-groups",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createClientGroupBodySchema.safeParse(request.body);
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
      const group = await service.createClientGroup(parsed.data, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(group);
    }
  );

  fastify.put<{ Params: { id: string }; Body: unknown }>(
    "/client-groups/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = clientGroupIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = updateClientGroupBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const group = await service.updateClientGroup(
        paramParsed.data.id,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(group);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/client-groups/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = clientGroupIdParamSchema.safeParse(request.params);
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
      await service.deleteClientGroup(parsed.data.id, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );
}
