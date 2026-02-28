/**
 * Shared constants — header casing must match OpenAPI exactly.
 */
export const CORRELATION_ID_HEADER = "X-Correlation-ID" as const;

/** Incoming header key (Node lowercases request headers). */
export const CORRELATION_ID_HEADER_LOWER = "x-correlation-id" as const;

/** Default warehouse for v1 (single-warehouse). Used when warehouseId omitted on order line items. */
export const DEFAULT_WAREHOUSE_ID = "00000000-0000-0000-0000-000000000010" as const;
