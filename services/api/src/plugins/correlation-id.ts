/**
 * Correlation ID plugin — OpenAPI: X-Correlation-ID in/out, on every response and error.
 * If request has X-Correlation-ID (any valid UUID format), use it; else generate UUID v4.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { randomUUID } from "crypto";
import { CORRELATION_ID_HEADER, CORRELATION_ID_HEADER_LOWER } from "../lib/constants.js";

/** Accept any UUID format per OpenAPI (format: uuid), not v4-only. */
function isValidUuid(value: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

async function correlationIdPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest("correlationId", "");

  fastify.addHook("onRequest", async (request: FastifyRequest, _reply: FastifyReply) => {
    const raw = request.headers[CORRELATION_ID_HEADER_LOWER];
    const value =
      typeof raw === "string" && isValidUuid(raw) ? raw : randomUUID();
    (request as FastifyRequest & { correlationId: string }).correlationId = value;
  });

  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload) => {
    const correlationId = (request as FastifyRequest & { correlationId: string }).correlationId;
    reply.header(CORRELATION_ID_HEADER, correlationId);
    return payload;
  });
}

export default fp(correlationIdPlugin, { name: "correlation-id" });

declare module "fastify" {
  interface FastifyRequest {
    correlationId: string;
  }
}
