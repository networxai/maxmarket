import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { prisma } from "../lib/prisma.js";
import { CORRELATION_ID_HEADER } from "../lib/constants.js";
import { AppError } from "../plugins/error-handler.js";
import { ErrorCodes } from "../lib/errors.js";

export async function healthRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  fastify.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", timestamp: new Date().toISOString() });
  });

  fastify.get("/ready", async (request, reply) => {
    const correlationId = (request as { correlationId: string }).correlationId;
    try {
      await prisma.$queryRaw`SELECT 1`;
      reply.header(CORRELATION_ID_HEADER, correlationId);
      return reply.send({ status: "ok" });
    } catch {
      throw new AppError(503, ErrorCodes.INTERNAL_ERROR, "Database not ready");
    }
  });
}
