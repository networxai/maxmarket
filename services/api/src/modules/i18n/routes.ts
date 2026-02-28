import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import * as service from "./service.js";
import { getUiStringsQuerySchema, putUiStringsBodySchema } from "./schemas.js";

export async function i18nRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{ Querystring: { language?: string } }>(
    "/i18n/ui-strings",
    async (request, reply) => {
      const correlationId = (request as { correlationId: string }).correlationId;
      const parsed = getUiStringsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        setCorrelation(reply, correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const result = await service.getUiStrings(parsed.data.language);
      setCorrelation(reply, correlationId);
      return reply.send(result);
    }
  );

  fastify.put<{ Body: unknown }>(
    "/i18n/ui-strings",
    { preHandler: [authMiddleware, requireRoles("super_admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = putUiStringsBodySchema.safeParse(request.body);
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
      const result = await service.upsertUiStrings(
        parsed.data.language,
        parsed.data.strings,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );
}
