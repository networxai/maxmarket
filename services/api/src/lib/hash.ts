/**
 * SHA-256 hash for refresh token storage (per 09_RBAC: store hash, not raw token).
 */
import { createHash } from "crypto";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
