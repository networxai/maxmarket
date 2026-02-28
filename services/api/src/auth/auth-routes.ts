/**
 * Auth routes — POST /auth/login, /auth/refresh, /auth/logout.
 * Refresh token: httpOnly cookie (CTO); body accepted as fallback for OpenAPI compatibility.
 */
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { appConfig } from "../config.js";
import { loginBodySchema } from "./validation.js";
import * as authService from "./auth-service.js";
import { ErrorCodes, buildErrorEnvelope } from "../lib/errors.js";
import { CORRELATION_ID_HEADER } from "../lib/constants.js";
import { zodDetailsToStable } from "../lib/zod-details.js";

const COOKIE_NAME = "refreshToken";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days, aligned with refresh TTL
const COOKIE_PATH = "/api/v1/auth";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: COOKIE_MAX_AGE,
  path: COOKIE_PATH,
};

type ReplyWithCookie = { setCookie: (n: string, v: string, o?: object) => unknown; clearCookie: (n: string, o?: object) => unknown };

function getRefreshTokenFromRequest(request: { cookies?: { refreshToken?: string }; body?: { refreshToken?: string } }): string | undefined {
  const fromCookie = request.cookies?.[COOKIE_NAME];
  if (fromCookie) return fromCookie;
  const fromBody = (request.body as { refreshToken?: string } | undefined)?.refreshToken;
  return fromBody;
}

export async function authRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.post<{
    Body: { email?: string; password?: string };
  }>(
    "/auth/login",
    {
      config: {
        rateLimit: appConfig.loginRateLimitDisabled
          ? false
          : { max: 10, timeWindow: "15 minutes" },
      },
    },
    async (request, reply) => {
    const correlationId = request.correlationId;
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      const envelope = buildErrorEnvelope(
        ErrorCodes.VALIDATION_ERROR,
        "Validation failed",
        correlationId,
        zodDetailsToStable(parsed.error)
      );
      return reply.status(422).header(CORRELATION_ID_HEADER, correlationId).send(envelope);
    }
    const { email, password } = parsed.data;
    const ipAddress = request.ip ?? undefined;
    const userAgent = request.headers["user-agent"] ?? undefined;

    try {
      const result = await authService.login(email, password, {
        ipAddress,
        userAgent,
        correlationId,
      });
      const rc = reply as unknown as ReplyWithCookie;
      rc.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
      reply.header(CORRELATION_ID_HEADER, correlationId);
      return reply.send({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid credentials";
      if (message === "INVALID_CREDENTIALS") {
        const envelope = buildErrorEnvelope(
          ErrorCodes.UNAUTHORIZED,
          "Invalid credentials",
          correlationId
        );
        return reply.status(401).header(CORRELATION_ID_HEADER, correlationId).send(envelope);
      }
      throw err;
    }
  });

  fastify.post<{ Body?: { refreshToken?: string } }>("/auth/refresh", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply) => {
    const correlationId = request.correlationId;
    const refreshToken = getRefreshTokenFromRequest(request);
    if (!refreshToken) {
      const envelope = buildErrorEnvelope(
        ErrorCodes.TOKEN_MISSING,
        "Refresh token required (cookie or body)",
        correlationId
      );
      return reply.status(401).header(CORRELATION_ID_HEADER, correlationId).send(envelope);
    }
    try {
      const result = await authService.refresh(refreshToken);
      const rc = reply as unknown as ReplyWithCookie;
      rc.setCookie(COOKIE_NAME, result.refreshToken, COOKIE_OPTIONS);
      reply.header(CORRELATION_ID_HEADER, correlationId);
      return reply.send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid token";
      const isReuse = message === "REFRESH_TOKEN_REUSED";
      if (isReuse) {
        const rc = reply as unknown as ReplyWithCookie;
        rc.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
      }
      const envelope = buildErrorEnvelope(
        ErrorCodes.UNAUTHORIZED,
        isReuse ? "Refresh token already used; all sessions revoked" : "Invalid or expired refresh token",
        correlationId
      );
      return reply.status(401).header(CORRELATION_ID_HEADER, correlationId).send(envelope);
    }
  });

  fastify.post<{ Body?: { refreshToken?: string } }>("/auth/logout", async (request, reply) => {
    const correlationId = request.correlationId;
    const refreshToken = getRefreshTokenFromRequest(request);
    if (refreshToken) {
      await authService.logout(refreshToken);
    }
    const rc = reply as unknown as ReplyWithCookie;
    rc.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });
    reply.header(CORRELATION_ID_HEADER, correlationId);
    return reply.status(200).send();
  });
}
