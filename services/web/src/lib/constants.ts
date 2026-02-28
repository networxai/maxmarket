export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export const CORRELATION_ID_HEADER = "X-Correlation-ID";

export const ACCEPT_LANGUAGE_HEADER = "Accept-Language";

export const API_PREFIX = "/api/v1";
