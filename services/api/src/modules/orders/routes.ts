import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import {
  listOrdersQuerySchema,
  orderIdParamSchema,
  orderVersionParamsSchema,
  orderIdLineItemParamSchema,
  createOrderBodySchema,
  updateOrderBodySchema,
  overridePriceBodySchema,
} from "./schemas.js";

export async function ordersRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{ Querystring: { page?: string; pageSize?: string; status?: string; clientId?: string; agentId?: string } }>(
    "/orders",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = listOrdersQuerySchema.safeParse(request.query);
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
        status: parsed.data.status,
        clientId: parsed.data.clientId,
        agentId: parsed.data.agentId,
      };
      const result = await service.listOrders(query, filter, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.post<{ Body: unknown }>(
    "/orders",
    { preHandler: [authMiddleware, requireRoles("agent")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createOrderBodySchema.safeParse(request.body);
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
      const order = await service.createDraft(parsed.data, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(order);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/orders/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
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
      const order = await service.getOrderById(parsed.data.id, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.put<{ Params: { id: string }; Body: unknown }>(
    "/orders/:id",
    { preHandler: [authMiddleware, requireRoles("agent", "admin", "super_admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = orderIdParamSchema.safeParse(request.params);
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
      const bodyParsed = updateOrderBodySchema.safeParse(request.body);
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
      const order = await service.updateOrder(
        paramParsed.data.id,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/orders/:id",
    { preHandler: [authMiddleware, requireRoles("agent")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
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
      await service.deleteOrder(parsed.data.id, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.status(204).send();
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/submit",
    { preHandler: [authMiddleware, requireRoles("agent")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.submitOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/approve",
    { preHandler: [authMiddleware, requireRoles("manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.approveOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/reject",
    { preHandler: [authMiddleware, requireRoles("manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.rejectOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/fulfill",
    { preHandler: [authMiddleware, requireRoles("manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.fulfillOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/cancel",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin", "manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.cancelOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/orders/:id/return",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin", "manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const order = await service.returnOrder(parsed.data.id, req.user, { correlationId: req.correlationId });
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/orders/:id/versions",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin", "manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const versions = await service.getOrderVersions(parsed.data.id, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(versions);
    }
  );

  fastify.get<{ Params: { id: string; versionNumber: string } }>(
    "/orders/:id/versions/:versionNumber",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin", "manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = orderVersionParamsSchema.safeParse({
        id: request.params.id,
        versionNumber: request.params.versionNumber,
      });
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(parsed.error))
        );
      }
      const version = await service.getOrderVersionByNumber(parsed.data.id, parsed.data.versionNumber, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(version);
    }
  );

  fastify.post<{ Params: { orderId: string; lineItemId: string }; Body: unknown }>(
    "/orders/:orderId/line-items/:lineItemId/override-price",
    { preHandler: [authMiddleware, requireRoles("manager")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = orderIdLineItemParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(paramParsed.error))
        );
      }
      const bodyParsed = overridePriceBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(ErrorCodes.VALIDATION_ERROR, "Validation failed", req.correlationId, zodDetailsToStable(bodyParsed.error))
        );
      }
      const order = await service.overrideLineItemPrice(
        paramParsed.data.orderId,
        paramParsed.data.lineItemId,
        bodyParsed.data.managerOverride,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(order);
    }
  );
}
