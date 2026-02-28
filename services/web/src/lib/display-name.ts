/**
 * Display name utility: prefer human-readable name, fallback to truncated ID.
 * Used when showing client, agent, product names instead of raw UUIDs.
 */
export function displayName(name?: string | null, id?: string | null): string {
  if (name && name.trim()) return name.trim();
  if (id && id.trim()) return id.substring(0, 8) + "…";
  return "—";
}
