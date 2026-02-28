/**
 * Auth middleware — verify JWT, attach req.user.
 * Returns 401 with error envelope when missing or invalid.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "./auth-service.js";
import { prisma } from "../lib/prisma.js";
import { ErrorCodes, buildErrorEnvelope } from "../lib/errors.js";
import { CORRELATION_ID_HEADER } from "../lib/constants.js";
import type { AuthUser } from "./types.js";

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
  correlationId: string;
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = (request as FastifyRequest & { correlationId: string }).correlationId;
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    const envelope = buildErrorEnvelope(
      ErrorCodes.TOKEN_MISSING,
      "Authorization header with Bearer token required",
      correlationId
    );
    reply.header(CORRELATION_ID_HEADER, correlationId);
    await reply.status(401).send(envelope);
    return;
  }
  try {
    const payload = authService.verifyAccessToken(token);
    const user = await getAuthUser(payload.userId);
    if (!user || !user.isActive) {
      const envelope = buildErrorEnvelope(
        ErrorCodes.UNAUTHORIZED,
        "User not found or inactive",
        correlationId
      );
      reply.header(CORRELATION_ID_HEADER, correlationId);
      await reply.status(401).send(envelope);
      return;
    }
    (request as AuthenticatedRequest).user = user;
  } catch (err) {
    const name = (err as Error).name;
    const code =
      name === "TokenExpiredError"
        ? ErrorCodes.TOKEN_EXPIRED
        : ErrorCodes.UNAUTHORIZED;
    const message =
      name === "TokenExpiredError"
        ? "Token expired"
        : "Invalid or malformed token";
    const envelope = buildErrorEnvelope(code, message, correlationId);
    reply.header(CORRELATION_ID_HEADER, correlationId);
    await reply.status(401).send(envelope);
  }
}

async function getAuthUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as AuthUser["role"],
    preferredLanguage: user.preferredLanguage,
    clientGroupId: user.clientGroupId,
    isActive: user.isActive,
  };
}
