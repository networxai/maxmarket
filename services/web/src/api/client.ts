import { v4 as uuidv4 } from "uuid";
import type { ErrorResponse } from "@/types/api";
import { API_BASE_URL, API_PREFIX, CORRELATION_ID_HEADER, ACCEPT_LANGUAGE_HEADER } from "@/lib/constants";

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details?: ErrorResponse["details"];
  readonly correlationId?: string;
  constructor(
    status: number,
    errorCode: string,
    message: string,
    details?: ErrorResponse["details"],
    correlationId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
    this.correlationId = correlationId;
  }
}

export type GetAccessToken = () => string | null;
export type GetLanguage = () => string;

const authInjectors: {
  getAccessToken: GetAccessToken;
  getLanguage: GetLanguage;
  onSessionExpired: () => void;
} = {
  getAccessToken: () => null,
  getLanguage: () => "en",
  onSessionExpired: () => {},
};

export function setAuthInjectors(
  accessToken: GetAccessToken,
  language: GetLanguage,
  sessionExpired: () => void
) {
  authInjectors.getAccessToken = accessToken;
  authInjectors.getLanguage = language;
  authInjectors.onSessionExpired = sessionExpired;
}

async function parseErrorResponse(response: Response): Promise<ErrorResponse> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as ErrorResponse;
    if (typeof json.errorCode === "string" && typeof json.message === "string") {
      return json;
    }
  } catch {
    // ignore
  }
  return {
    errorCode: "UNKNOWN",
    message: text || response.statusText || "Request failed",
    correlationId: response.headers.get(CORRELATION_ID_HEADER) ?? "",
  };
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [CORRELATION_ID_HEADER]: uuidv4(),
      [ACCEPT_LANGUAGE_HEADER]: authInjectors.getLanguage(),
    },
    body: JSON.stringify({ refreshToken: "" }),
  });
  if (!res.ok) {
    const err = await parseErrorResponse(res);
    if (err.errorCode === "TOKEN_EXPIRED" || err.errorCode === "UNAUTHORIZED") {
      authInjectors.onSessionExpired();
    }
    return null;
  }
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken ?? null;
}

export interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefreshRetry?: boolean;
  accessToken?: string | null;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    skipAuth = false,
    skipRefreshRetry = false,
    accessToken: explicitToken,
    ...init
  } = options;

  const correlationId = uuidv4();
  const language = authInjectors.getLanguage();
  const token = explicitToken ?? (skipAuth ? null : authInjectors.getAccessToken());

  const headers = new Headers(init.headers);
  headers.set(CORRELATION_ID_HEADER, correlationId);
  headers.set(ACCEPT_LANGUAGE_HEADER, language);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${API_PREFIX}${path}`;
  let response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !skipRefreshRetry && !skipAuth) {
    const body = await response.clone().json().catch(() => ({})) as { errorCode?: string };
    if (body.errorCode === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        response = await fetch(url, {
          ...init,
          headers,
          credentials: "include",
        });
      }
    } else {
      authInjectors.onSessionExpired();
    }
  }

  if (!response.ok) {
    const err = await parseErrorResponse(response);
    throw new ApiError(
      response.status,
      err.errorCode,
      err.message,
      err.details ?? undefined,
      err.correlationId
    );
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  return response.text() as Promise<T>;
}
