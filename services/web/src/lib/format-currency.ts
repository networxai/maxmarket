/** Extract revenue from report row; API may return `revenue` or `totalRevenue` (DL-18). */
export function getRevenue(row: { revenue?: number; totalRevenue?: number }): number {
  return (row.revenue ?? row.totalRevenue ?? 0) || 0;
}

/**
 * Armenian Dram (֏) currency formatter.
 * Symbol after price, no decimals, rounded to nearest whole number.
 */
export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "—";
  return `${Math.round(num)} ֏`;
}
