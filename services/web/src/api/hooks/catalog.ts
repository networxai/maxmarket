import { useQuery } from "@tanstack/react-query";
import type { Category, Product, ProductsListResponse } from "@/types/api";
import { apiRequest } from "@/api/client";

export interface ProductsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
}

export function useProducts(params: ProductsParams = {}) {
  const { page = 1, pageSize = 20, search, category } = params;
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(pageSize));
  if (search) searchParams.set("search", search);
  if (category) searchParams.set("category", category);

  return useQuery({
    queryKey: ["catalog", "products", page, pageSize, search ?? null, category ?? null],
    queryFn: () =>
      apiRequest<ProductsListResponse>(`/catalog/products?${searchParams.toString()}`),
  });
}

export function useProduct(id: string | null) {
  return useQuery({
    queryKey: ["catalog", "product", id],
    queryFn: () => apiRequest<Product>(`/catalog/products/${id}`),
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: () => apiRequest<Category[]>("/catalog/categories"),
  });
}
