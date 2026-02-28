/**
 * Report and audit types aligned with OpenAPI.
 */

import type { PaginationMeta } from "./api";

export interface SalesReportRow {
  dimension: string;
  dimensionLabel: string;
  orderCount: number;
  totalQty: number;
  totalRevenue: number;
  currencyNote?: string | null;
}

export interface SalesByManagerRow {
  managerId: string;
  managerName: string;
  orderCount: number;
  totalRevenue: number;
}

export interface SalesReportResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface AuditLogEntry {
  id: string;
  eventType: string;
  actorId: string | null;
  actorName?: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  correlationId: string | null;
  clearedAt: string | null;
  createdAt: string;
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: PaginationMeta;
}

export interface ClearAuditLogsRequest {
  scope: "before_date";
  beforeDate: string;
}

export interface ClearAuditLogsResponse {
  clearedCount: number;
}
