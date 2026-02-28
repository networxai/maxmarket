/**
 * Admin-related types aligned with OpenAPI.
 */

import type { PaginationMeta } from "./api";

export interface ClientGroup {
  id: string;
  name: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
}

export interface ClientGroupsListResponse {
  data: ClientGroup[];
  pagination: PaginationMeta;
}

export interface WarehouseStock {
  variantId: string;
  sku: string;
  productName?: string | null;
  warehouseId: string;
  availableQty: number;
  reservedQty: number;
}

export interface StockListResponse {
  data: WarehouseStock[];
  pagination: PaginationMeta;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  fullName: string;
  role: string;
  preferredLanguage?: string;
  clientGroupId?: string | null;
}

export interface UpdateUserRequest {
  fullName?: string;
  preferredLanguage?: string;
  role?: string;
  isActive?: boolean;
  clientGroupId?: string | null;
}

export interface CreateClientGroupRequest {
  name: string;
  discountType: "fixed" | "percentage";
  discountValue: number;
}

export interface UpdateClientGroupRequest {
  name?: string;
  discountType?: "fixed" | "percentage";
  discountValue?: number;
}

export interface AdjustStockRequest {
  warehouseId: string;
  variantId: string;
  newAvailableQty: number;
  reason: string;
}

export interface CreateProductRequest {
  name: { en: string; hy?: string | null; ru?: string | null };
  description?: { en: string; hy?: string | null; ru?: string | null };
  categoryId?: string | null;
  variants: Array<{
    sku: string;
    unitType: "piece" | "box" | "kg";
    minOrderQty: number;
    costPrice: number;
    pricePerUnit: number;
    pricePerBox?: number | null;
  }>;
}

export interface UpdateProductRequest {
  name?: { en: string; hy?: string | null; ru?: string | null };
  description?: { en: string; hy?: string | null; ru?: string | null };
  categoryId?: string | null;
  isActive?: boolean;
}

export interface CreateVariantRequest {
  sku: string;
  unitType: "piece" | "box" | "kg";
  minOrderQty: number;
  costPrice: number;
  pricePerUnit: number;
  pricePerBox?: number | null;
}

export interface UpdateVariantRequest {
  sku?: string;
  unitType?: "piece" | "box" | "kg";
  minOrderQty?: number;
  costPrice?: number;
  pricePerUnit?: number;
  pricePerBox?: number | null;
  isActive?: boolean;
}

export interface AddImageRequest {
  url: string;
  sortOrder?: number;
}

export interface ReorderImagesRequest {
  imageIds: string[];
}

export interface CreateCategoryRequest {
  name: { en: string; hy?: string | null; ru?: string | null };
}

export interface UpdateCategoryRequest {
  name: { en: string; hy?: string | null; ru?: string | null };
}

export interface VariantImage {
  id: string;
  url: string;
  sortOrder: number;
}
