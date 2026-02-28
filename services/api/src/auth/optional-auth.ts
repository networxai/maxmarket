/**
 * Optional auth — attach req.user if valid Bearer; otherwise leave undefined.
 * For public routes that can return different shapes when authenticated.
 */
import type { FastifyRequest, FastifyReply } from "fastify";
import * as authService from "./auth-service.js";
import { prisma } from "../lib/prisma.js";
import type { AuthUser } from "./types.js";

export interface RequestWithOptionalUser extends FastifyRequest {
  user?: AuthUser;
  correlationId: string;
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const req = request as RequestWithOptionalUser;
  const token = extractBearerToken(request.headers.authorization);
  if (!token) return;
  try {
    const payload = authService.verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
    });
    if (user?.isActive) {
      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role as AuthUser["role"],
        preferredLanguage: user.preferredLanguage,
        clientGroupId: user.clientGroupId,
        isActive: user.isActive,
      };
    }
  } catch {
    // Invalid/expired token — treat as unauthenticated, do not 401
  }
}
