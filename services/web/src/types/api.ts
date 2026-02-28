/**
 * Types aligned with OpenAPI v1.0.2 (ErrorResponse, User, Catalog, Pagination).
 */

export type Role =
  | "super_admin"
  | "admin"
  | "manager"
  | "agent"
  | "client";

export type Language = "en" | "hy" | "ru";

export interface ErrorResponse {
  errorCode: string;
  message: string;
  details?: Array<{ path?: string; message?: string }> | null;
  correlationId: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  preferredLanguage: Language;
  isActive: boolean;
  clientGroupId?: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface MultilingualString {
  en: string;
  hy?: string | null;
  ru?: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface VariantImage {
  id: string;
  url: string;
  sortOrder: number;
}

/** Public variant (no price fields). */
export interface PublicProductVariant {
  id: string;
  sku: string;
  unitType: "piece" | "box" | "kg";
  minOrderQty: number;
  images?: VariantImage[];
  isActive: boolean;
}

/** Authenticated variant (may include price fields per role). */
export interface ProductVariant extends PublicProductVariant {
  costPrice?: number | null;
  pricePerUnit?: number;
  pricePerBox?: number | null;
  clientPrice?: number | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  description?: string;
  category?: { id: string; name: string };
  variants: PublicProductVariant[];
  isActive: boolean;
}

export interface Product extends PublicProduct {
  variants: ProductVariant[];
}

export type ProductListItem = PublicProduct | Product;

export interface ProductsListResponse {
  data: ProductListItem[];
  pagination: PaginationMeta;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}
