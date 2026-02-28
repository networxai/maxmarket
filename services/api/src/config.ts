/**
 * Load env from .env.local (or .env). Validated at runtime.
 */
import { config } from "dotenv";
import { resolve } from "path";

// Prefer .env.local; fallback to .env
const envLocal = resolve(process.cwd(), ".env.local");
const envDefault = resolve(process.cwd(), ".env");
config({ path: envLocal });
config({ path: envDefault });

const env = process.env;

export const appConfig = {
  nodeEnv: env.NODE_ENV ?? "development",
  port: parseInt(env.PORT ?? "3000", 10),
  apiPrefix: env.API_PREFIX ?? "/api/v1",
  corsOrigin: env.CORS_ORIGIN ?? "http://localhost:5173",
  logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug"),
  bodyLimit: 1048576, // 1MB

  database: {
    url: env.DATABASE_URL,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET ?? "",
    refreshSecret: env.JWT_REFRESH_SECRET ?? "",
    accessTokenExpiresIn: env.JWT_ACCESS_TTL ?? "15m",
    refreshTokenExpiresIn: env.JWT_REFRESH_TTL ?? "7d",
  },

  /** Set LOGIN_RATE_LIMIT_DISABLED=true for QA; disables 10/15min login rate limit. Re-enable (unset) for production. */
  loginRateLimitDisabled: env.LOGIN_RATE_LIMIT_DISABLED === "true",
} as const;

if (!appConfig.database.url) {
  throw new Error("DATABASE_URL is required");
}
if (!appConfig.jwt.accessSecret || !appConfig.jwt.refreshSecret) {
  throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required");
}
