import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import {
  salesByDateQuerySchema,
  salesByManagerQuerySchema,
  salesByClientQuerySchema,
  salesByProductQuerySchema,
  exportReportQuerySchema,
} from "./schemas.js";

export async function reportsRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; dateFrom?: string; dateTo?: string };
  }>(
    "/reports/sales-by-date",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = salesByDateQuerySchema.safeParse(request.query);
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
      const result = await service.salesByDate(
        query,
        { fromDate: parsed.data.dateFrom, toDate: parsed.data.dateTo },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; fromDate?: string; toDate?: string };
  }>(
    "/reports/sales-by-manager",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = salesByManagerQuerySchema.safeParse(request.query);
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
      const result = await service.salesByManager(
        query,
        { fromDate: parsed.data.dateFrom, toDate: parsed.data.dateTo },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; clientId?: string; dateFrom?: string; dateTo?: string };
  }>(
    "/reports/sales-by-client",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = salesByClientQuerySchema.safeParse(request.query);
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
      const result = await service.salesByClient(
        query,
        {
          clientId: parsed.data.clientId,
          fromDate: parsed.data.dateFrom,
          toDate: parsed.data.dateTo,
        },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; variantId?: string; dateFrom?: string; dateTo?: string };
  }>(
    "/reports/sales-by-product",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = salesByProductQuerySchema.safeParse(request.query);
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
      const result = await service.salesByProduct(
        query,
        {
          variantId: parsed.data.variantId,
          fromDate: parsed.data.dateFrom,
          toDate: parsed.data.dateTo,
        },
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.get<{
    Querystring: { reportType?: string; format?: string; dateFrom?: string; dateTo?: string; clientId?: string; variantId?: string };
  }>(
    "/reports/:reportType/export",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const params = {
        reportType: (request.params as { reportType: string }).reportType,
        format: request.query.format ?? "csv",
        dateFrom: request.query.dateFrom,
        dateTo: request.query.dateTo,
        clientId: request.query.clientId,
        variantId: request.query.variantId,
      };
      const parsed = exportReportQuerySchema.safeParse(params);
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
      const result = await service.exportReport(
        parsed.data.reportType,
        parsed.data.format,
        {
          fromDate: parsed.data.dateFrom,
          toDate: parsed.data.dateTo,
          clientId: parsed.data.clientId,
          variantId: parsed.data.variantId,
        },
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      if (parsed.data.format === "csv" && result && typeof result === "object" && "content" in result) {
        return reply
          .header("Content-Type", "text/csv")
          .send((result as { content: string }).content);
      }
      return reply.send(result);
    }
  );
}
