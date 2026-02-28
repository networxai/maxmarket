/**
 * Standardize Zod errors to stable { path, message }[] for 422 details.
 */
import type { ZodError } from "zod";

export function zodDetailsToStable(zodError: ZodError): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  for (const issue of zodError.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    out.push({ path, message: issue.message });
  }
  return out;
}
