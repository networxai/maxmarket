/**
 * Centralized error handler — camelCase envelope per OpenAPI ErrorResponse.
 * Map: Zod -> 422 VALIDATION_ERROR; Unauth -> 401; RBAC -> 403; Not found -> 404;
 * Optimistic lock/conflict -> 409; Unexpected -> 500.
 */
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { buildErrorEnvelope, ErrorCodes, type ErrorCode } from "../lib/errors.js";
import { CORRELATION_ID_HEADER } from "../lib/constants.js";
import { zodDetailsToStable } from "../lib/zod-details.js";

/** Custom app errors (status + code). Use OPTIMISTIC_LOCK_CONFLICT for version/lock conflicts. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorCode: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

function getCorrelationId(request: FastifyRequest): string {
  return (request as FastifyRequest & { correlationId: string }).correlationId;
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  envelope: { errorCode: string; message: string; details?: unknown; correlationId: string }
): void {
  reply.header(CORRELATION_ID_HEADER, envelope.correlationId);
  void reply.status(statusCode).send(envelope);
}

async function errorHandler(
  error: FastifyError | Error | AppError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const correlationId = getCorrelationId(request);

  // Zod validation -> 422 VALIDATION_ERROR; details = { path, message }[]
  if (error instanceof ZodError) {
    const details = zodDetailsToStable(error);
    const envelope = buildErrorEnvelope(
      ErrorCodes.VALIDATION_ERROR,
      "Validation failed",
      correlationId,
      details
    );
    sendError(reply, 422, envelope);
    return;
  }

  // App errors (status + code; 409 => OPTIMISTIC_LOCK_CONFLICT or CONFLICT per caller)
  if (error instanceof AppError) {
    const envelope = buildErrorEnvelope(
      error.errorCode,
      error.message,
      correlationId,
      error.details
    );
    sendError(reply, error.statusCode, envelope);
    return;
  }

  // Fastify validation errors -> 422; details = { path, message }[]
  const fastifyErr = error as FastifyError;
  if (fastifyErr.validation) {
    const details = Array.isArray(fastifyErr.validation)
      ? fastifyErr.validation.map((v) => ({
          path: (v.params as { key?: string })?.key ?? (v as { instancePath?: string }).instancePath ?? "(root)",
          message: (v as { message?: string }).message ?? "Validation failed",
        }))
      : [];
    const envelope = buildErrorEnvelope(
      ErrorCodes.VALIDATION_ERROR,
      fastifyErr.message ?? "Validation failed",
      correlationId,
      details
    );
    sendError(reply, 422, envelope);
    return;
  }

  // Fastify statusCode fallback (409 => CONFLICT; use AppError for OPTIMISTIC_LOCK_CONFLICT; 501 => NOT_IMPLEMENTED)
  if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode >= 400) {
    const code: ErrorCode =
      fastifyErr.statusCode === 401
        ? ErrorCodes.TOKEN_EXPIRED
        : fastifyErr.statusCode === 403
          ? ErrorCodes.FORBIDDEN
          : fastifyErr.statusCode === 404
            ? ErrorCodes.NOT_FOUND
      : fastifyErr.statusCode === 429
        ? ErrorCodes.RATE_LIMITED
            : fastifyErr.statusCode === 409
              ? ErrorCodes.CONFLICT
              : fastifyErr.statusCode === 501
                ? ErrorCodes.NOT_IMPLEMENTED
                : ErrorCodes.INTERNAL_ERROR;
    const envelope = buildErrorEnvelope(
      code,
      fastifyErr.message ?? "Request failed",
      correlationId,
      undefined
    );
    sendError(reply, fastifyErr.statusCode, envelope);
    return;
  }

  // Unexpected -> 500 (do not log full error with secrets)
  request.log?.error?.({ err: error, correlationId }, "Unhandled error");
  const envelope = buildErrorEnvelope(
    ErrorCodes.INTERNAL_ERROR,
    "Internal server error",
    correlationId,
    undefined
  );
  sendError(reply, 500, envelope);
}

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler(errorHandler);
}

export default fp(errorHandlerPlugin, { name: "error-handler" });
