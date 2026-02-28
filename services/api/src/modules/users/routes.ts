/**
 * Users — routes per OpenAPI. Auth + RBAC enforced.
 */
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import {
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  userIdParamSchema,
  agentIdParamSchema,
  agentClientParamsSchema,
} from "./schemas.js";

export async function usersRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; role?: string; isActive?: string };
  }>(
    "/users",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = listUsersQuerySchema.safeParse({
        page: request.query?.page,
        pageSize: request.query?.pageSize,
        role: request.query?.role,
        isActive: request.query?.isActive,
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
      const filter = {
        role: parsed.data.role,
        isActive: parsed.data.isActive,
      };
      const result = await service.listUsers(query, filter, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.post<{ Body: unknown }>(
    "/users",
    { preHandler: [authMiddleware, requireRoles("super_admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createUserBodySchema.safeParse(request.body);
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
      const user = await service.createUser(parsed.data, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(user);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = userIdParamSchema.safeParse(request.params);
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
      const user = await service.getUserById(parsed.data.id, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(user);
    }
  );

  fastify.put<{ Params: { id: string }; Body: unknown }>(
    "/users/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = userIdParamSchema.safeParse(request.params);
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
      const bodyParsed = updateUserBodySchema.safeParse(request.body ?? {});
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
      const user = await service.updateUser(
        paramParsed.data.id,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(user);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/users/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = userIdParamSchema.safeParse(request.params);
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
      await service.deactivateUser(parsed.data.id, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  fastify.get<{
    Params: { agentId: string };
    Querystring: { page?: string; pageSize?: string };
  }>(
    "/users/:agentId/clients",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = agentIdParamSchema.safeParse(request.params);
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
      const query = parsePaginationQuery(request.query?.page, request.query?.pageSize);
      const result = await service.getAgentClients(
        paramParsed.data.agentId,
        query,
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.post<{ Params: { agentId: string; clientId: string } }>(
    "/users/:agentId/clients/:clientId",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = agentClientParamsSchema.safeParse(request.params);
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
      await service.assignClientToAgent(
        parsed.data.agentId,
        parsed.data.clientId,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  fastify.delete<{ Params: { agentId: string; clientId: string } }>(
    "/users/:agentId/clients/:clientId",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = agentClientParamsSchema.safeParse(request.params);
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
      await service.removeClientFromAgent(
        parsed.data.agentId,
        parsed.data.clientId,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );
}
