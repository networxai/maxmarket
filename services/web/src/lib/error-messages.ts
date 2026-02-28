import type { ApiError } from "@/api/client";

const ERROR_KEYS: Record<string, string> = {
  FORBIDDEN: "errors.access_denied",
  TOKEN_EXPIRED: "errors.session_expired",
  TOKEN_MISSING: "errors.session_expired",
  UNAUTHORIZED: "errors.session_expired",
  RATE_LIMITED: "errors.rate_limited",
  NOT_FOUND: "errors.not_found",
  NOT_IMPLEMENTED: "errors.something_wrong",
};

export function getErrorMessage(
  error: unknown,
  t?: (key: string) => string
): string {
  if (error instanceof Error && "errorCode" in error) {
    const apiErr = error as ApiError;
    if (apiErr.errorCode === "VALIDATION_ERROR" && apiErr.details?.length) {
      return apiErr.details
        .map((d) => d.message ?? d.path)
        .join(". ");
    }
    if (apiErr.errorCode === "CONFLICT") {
      return apiErr.message;
    }
    const key = ERROR_KEYS[apiErr.errorCode];
    if (t && key) return t(key);
    // Fallback without t
    switch (apiErr.errorCode) {
      case "VALIDATION_ERROR":
        return apiErr.message;
      case "FORBIDDEN":
        return "Access denied";
      case "TOKEN_EXPIRED":
      case "TOKEN_MISSING":
      case "UNAUTHORIZED":
        return "Session expired, please log in again.";
      case "RATE_LIMITED":
        return "Too many requests. Please wait and try again.";
      case "NOT_FOUND":
        return "Not found.";
      case "NOT_IMPLEMENTED":
        return "This feature is not yet available.";
      default:
        return apiErr.message;
    }
  }
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return t ? t("errors.unable_to_connect") : "Unable to connect.";
  }
  if (error instanceof Error) return error.message;
  return t ? t("errors.something_wrong") : "An unexpected error occurred.";
}
