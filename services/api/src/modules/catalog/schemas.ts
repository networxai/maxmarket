import { z } from "zod";

const unitTypeEnum = z.enum(["piece", "box", "kg"]);
const langKey = z.enum(["en", "hy", "ru"]);

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: z.string().uuid().optional(),
});

export const productIdParamSchema = z.object({ id: z.string().uuid() });
export const productIdOnlyParamSchema = z.object({ productId: z.string().uuid() });
export const productVariantParamsSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
});
export const productVariantImageParamsSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  imageId: z.string().uuid(),
});
export const categoryIdParamSchema = z.object({ id: z.string().uuid() });

export const createProductBodySchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.record(langKey, z.string()),
  description: z.record(langKey, z.string()).optional(),
  variants: z.array(
    z.object({
      sku: z.string().min(1),
      unitType: unitTypeEnum,
      minOrderQty: z.number().int().min(1).default(1),
      costPrice: z.number().min(0),
      pricePerUnit: z.number().min(0),
      pricePerBox: z.number().min(0).nullable().optional(),
    })
  ).min(1),
});

export const updateProductBodySchema = z.object({
  name: z.record(langKey, z.string()).optional(),
  description: z.record(langKey, z.string()).optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

export const createVariantBodySchema = z.object({
  sku: z.string().min(1),
  unitType: unitTypeEnum,
  minOrderQty: z.number().int().min(1).default(1),
  costPrice: z.number().min(0),
  pricePerUnit: z.number().min(0),
  pricePerBox: z.number().min(0).nullable().optional(),
});

export const updateVariantBodySchema = z.object({
  sku: z.string().min(1).optional(),
  unitType: unitTypeEnum.optional(),
  minOrderQty: z.number().int().min(1).optional(),
  costPrice: z.number().min(0).optional(),
  pricePerUnit: z.number().min(0).optional(),
  pricePerBox: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createCategoryBodySchema = z.object({
  name: z.record(langKey, z.string()),
});
export const updateCategoryBodySchema = z.object({
  name: z.record(langKey, z.string()).optional(),
});

export const addVariantImageBodySchema = z.object({
  url: z.string().url(),
});

export const reorderVariantImagesBodySchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type CreateVariantBody = z.infer<typeof createVariantBodySchema>;
export type UpdateVariantBody = z.infer<typeof updateVariantBodySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
