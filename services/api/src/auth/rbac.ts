/**
 * RBAC middleware — requireRoles(...roles). Returns 403 with envelope when denied.
 * Per docs/09_RBAC_SECURITY.md; resource ownership (agent/client scoping) in service layer.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import { ErrorCodes, buildErrorEnvelope } from "../lib/errors.js";
import { CORRELATION_ID_HEADER } from "../lib/constants.js";
import type { AuthUser } from "./types.js";
import type { AuthenticatedRequest } from "./auth-middleware.js";

export type Role = AuthUser["role"];

export function requireRoles(...allowedRoles: Role[]) {
  return async function rbacHook(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const req = request as AuthenticatedRequest;
    const user = req.user;
    const correlationId = req.correlationId;
    if (!user) {
      const envelope = buildErrorEnvelope(
        ErrorCodes.TOKEN_MISSING,
        "Authentication required",
        correlationId
      );
      reply.header(CORRELATION_ID_HEADER, correlationId);
      await reply.status(401).send(envelope);
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      const envelope = buildErrorEnvelope(
        ErrorCodes.FORBIDDEN,
        "Insufficient permissions",
        correlationId
      );
      reply.header(CORRELATION_ID_HEADER, correlationId);
      await reply.status(403).send(envelope);
    }
  };
}
