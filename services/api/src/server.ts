/**
 * MaxMarket API — Fastify bootstrap
 * Base path: /api/v1 (OpenAPI). Health at /health (no prefix).
 */
import { fileURLToPath } from "node:url";
import type { FastifyRequest } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import correlationIdPlugin from "./plugins/correlation-id.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import { appConfig } from "./config.js";
import { ErrorCodes } from "./lib/errors.js";
import { healthRoutes } from "./routes/health.js";
import { apiV1Routes } from "./routes/api-v1.js";

export async function build() {
  const fastify = Fastify({
    logger: { level: appConfig.logLevel },
    bodyLimit: appConfig.bodyLimit,
  });

  // Accept empty body with Content-Type: application/json (e.g. POST /orders/{id}/submit with {} or no body)
  // Fastify throws FST_ERR_CTP_EMPTY_JSON_BODY otherwise. Frontend often sends Content-Type: application/json on all POST.
  fastify.addHook("preParsing", (request, _reply, payload, done) => {
    const contentType = request.headers["content-type"];
    const contentLength = request.headers["content-length"];
    if (
      contentType?.includes("application/json") &&
      (contentLength === "0" || contentLength === undefined)
    ) {
      delete request.headers["content-type"];
    }
    done(null, payload);
  });

  await fastify.register(cors, {
    origin: appConfig.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID", "Accept-Language"],
    exposedHeaders: ["X-Correlation-ID"],
  });
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" },
  });
  await fastify.register(correlationIdPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(cookie, { secret: appConfig.jwt.refreshSecret });
  await fastify.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
    errorResponseBuilder: (req: FastifyRequest, context: { ttl: number }) => {
      const correlationId = (req as { correlationId?: string }).correlationId ?? "unknown";
      return {
        errorCode: ErrorCodes.RATE_LIMITED,
        message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
        correlationId,
      };
    },
  });

  // Health (no prefix) — for k8s/load balancers
  await fastify.register(healthRoutes);

  // API v1 — matches OpenAPI base path
  await fastify.register(apiV1Routes, { prefix: appConfig.apiPrefix });

  return fastify;
}

async function start() {
  const app = await build();
  try {
    await app.listen({ port: appConfig.port, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  start();
}
