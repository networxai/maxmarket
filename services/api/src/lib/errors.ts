/**
 * Standard error envelope per OpenAPI ErrorResponse (camelCase).
 * All error responses use this shape; correlationId set by plugin/handler.
 */
export interface ErrorEnvelope {
  errorCode: string;
  message: string;
  details?: unknown;
  correlationId: string;
}

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TOKEN_MISSING: "TOKEN_MISSING",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  ORDER_NOT_EDITABLE: "ORDER_NOT_EDITABLE",
  OPTIMISTIC_LOCK_CONFLICT: "OPTIMISTIC_LOCK_CONFLICT",
  STOCK_BELOW_RESERVED: "STOCK_BELOW_RESERVED",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Build envelope; caller must set correlationId from request. */
export function buildErrorEnvelope(
  errorCode: ErrorCode,
  message: string,
  correlationId: string,
  details?: unknown
): ErrorEnvelope {
  return {
    errorCode,
    message,
    ...(details !== undefined && details !== null && { details }),
    correlationId,
  };
}
