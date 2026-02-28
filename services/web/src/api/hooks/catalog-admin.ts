import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import type {
  CreateProductRequest,
  UpdateProductRequest,
  CreateVariantRequest,
  UpdateVariantRequest,
  AddImageRequest,
  ReorderImagesRequest,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@/types/admin";
import type { Product, ProductVariant, Category } from "@/types/api";

function invalidateCatalog(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["catalog"] });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProductRequest) =>
      apiRequest<Product>("/catalog/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateCatalog(qc),
  });
}

export function useUpdateProduct(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProductRequest) =>
      apiRequest<Product>(`/catalog/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (id) void qc.invalidateQueries({ queryKey: ["catalog", "product", id] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/catalog/products/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateCatalog(qc),
  });
}

export function useCreateVariant(productId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateVariantRequest) =>
      apiRequest<ProductVariant>(
        `/catalog/products/${productId}/variants`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useUpdateVariant(productId: string | null, variantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateVariantRequest) =>
      apiRequest<ProductVariant>(
        `/catalog/products/${productId}/variants/${variantId}`,
        { method: "PUT", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useDeleteVariant(productId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) =>
      apiRequest(`/catalog/products/${productId}/variants/${variantId}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useAddVariantImage(productId: string | null, variantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AddImageRequest) =>
      apiRequest<{ id: string; url: string; sortOrder: number }>(
        `/catalog/products/${productId}/variants/${variantId}/images`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useDeleteVariantImage(productId: string | null, variantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (imageId: string) =>
      apiRequest(
        `/catalog/products/${productId}/variants/${variantId}/images/${imageId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useReorderVariantImages(productId: string | null, variantId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ReorderImagesRequest) =>
      apiRequest(
        `/catalog/products/${productId}/variants/${variantId}/images/reorder`,
        { method: "PUT", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      invalidateCatalog(qc);
      if (productId) void qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCategoryRequest) =>
      apiRequest<Category>("/catalog/categories", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidateCatalog(qc),
  });
}

export function useUpdateCategory(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateCategoryRequest) =>
      apiRequest<Category>(`/catalog/categories/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => invalidateCatalog(qc),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/catalog/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateCatalog(qc),
  });
}
