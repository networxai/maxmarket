/**
 * Order-related types aligned with OpenAPI v1.0.2.
 */

import type { PaginationMeta, User } from "./api";

export type OrderStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "fulfilled"
  | "rejected"
  | "cancelled"
  | "returned";

export interface OrderLineItem {
  id: string;
  variantId: string;
  sku: string;
  warehouseId: string;
  qty: number;
  unitType: string;
  /** Captured at order creation. Stripped for client. */
  basePrice?: number;
  /** Group discount at submission. Stripped for client. */
  groupDiscount?: number;
  /** Visible to all roles. */
  finalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName?: string | null;
  agentId: string | null;
  agentName?: string | null;
  status: OrderStatus;
  currentVersion: number;
  versionLock: number;
  lineItems: OrderLineItem[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderVersionSummary {
  versionNumber: number;
  createdByUserId: string;
  createdAt: string;
  diffSummary: string;
}

export interface OrderVersionDiffItem {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface OrderVersionDetail {
  versionNumber: number;
  snapshot: Order;
  diff: OrderVersionDiffItem[];
  createdByUserId: string;
  createdAt: string;
}

export interface InsufficientStockDetail {
  lineItemId: string;
  variantId: string;
  sku: string;
  requestedQty: number;
  availableQty: number;
  reservedQty: number;
}

export interface OrdersListResponse {
  data: Order[];
  pagination: PaginationMeta;
}

export interface OrderVersionsListResponse {
  data: OrderVersionSummary[];
  pagination: PaginationMeta;
}

/** POST /orders */
export interface CreateOrderRequest {
  clientId: string;
  lineItems: Array<{ variantId: string; qty: number; warehouseId?: string }>;
  notes?: string | null;
}

/** PUT /orders/{id} */
export interface UpdateOrderRequest {
  lineItems: Array<{ variantId: string; qty: number; warehouseId?: string }>;
  notes?: string | null;
  versionLock?: number;
}

/** POST /orders/{id}/approve */
export interface ApproveOrderRequest {
  versionLock: number;
}

/** POST /orders/{id}/reject */
export interface RejectOrderRequest {
  reason?: string | null;
}

/** POST override-price */
export interface OverridePriceRequest {
  overridePrice: number;
}

export interface AgentClientsResponse {
  data: User[];
  pagination: PaginationMeta;
}
