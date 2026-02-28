/**
 * Catalog — public (no prices) vs authenticated (role-based stripping).
 */
import type { Role } from "../../auth/types.js";
import { AppError } from "../../plugins/error-handler.js";
import { ErrorCodes } from "../../lib/errors.js";
import { paginationMeta, type PaginationQuery } from "../../lib/pagination.js";
import { resolveLang, type Multilingual } from "../../lib/i18n.js";
import { writeAudit } from "../../audit/audit-service.js";
import { prisma } from "../../lib/prisma.js";
import * as repo from "./repo.js";
import type {
  CreateProductBody,
  UpdateProductBody,
  CreateVariantBody,
  UpdateVariantBody,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "./schemas.js";

type AuthUser = { id: string; role: Role; clientGroupId: string | null };

function categoryToResponse(cat: { id: string; name: unknown }, lang: string) {
  return {
    id: cat.id,
    name: resolveLang(cat.name as Multilingual, lang),
  };
}

/** Image object returned in variant responses (id required for delete/reorder). */
export interface VariantImage {
  id: string;
  url: string;
  sortOrder: number;
}

/** Public variant: NO price fields (omitted entirely, not even null). */
export interface PublicProductVariant {
  id: string;
  sku: string;
  unitType: string;
  minOrderQty: number;
  isActive: boolean;
  images: VariantImage[];
}

/** Public product: NO price fields anywhere. */
export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  category: { id: string; name: string } | null;
  variants: PublicProductVariant[];
  isActive: boolean;
}

/** DTO mapper: only allowed fields; never include costPrice, pricePerUnit, pricePerBox, clientPrice. */
function toPublicVariant(v: {
  id: string;
  sku: string;
  unitType: string;
  minOrderQty: number;
  isActive: boolean;
  images: Array<{ id: string; url: string; sortOrder: number }>;
}): PublicProductVariant {
  return {
    id: v.id,
    sku: v.sku,
    unitType: v.unitType,
    minOrderQty: v.minOrderQty,
    isActive: v.isActive,
    images: v.images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
  };
}

/** Public product DTO: only allowed fields; price fields are never present. */
function toPublicProduct(
  p: {
    id: string;
    name: unknown;
    description: unknown;
    category: { id: string; name: unknown } | null;
    variants: Array<{
      id: string;
      sku: string;
      unitType: string;
      minOrderQty: number;
      isActive: boolean;
      images: Array<{ id: string; url: string; sortOrder: number }>;
    }>;
    isActive: boolean;
  },
  lang: string
): PublicProduct {
  return {
    id: p.id,
    name: resolveLang(p.name as Multilingual, lang),
    description: resolveLang(p.description as Multilingual, lang),
    category: p.category ? categoryToResponse(p.category, lang) : null,
    variants: p.variants.map(toPublicVariant),
    isActive: p.isActive,
  };
}

function variantToProduct(
  v: {
    id: string;
    sku: string;
    unitType: string;
    minOrderQty: number;
    costPrice: { toNumber: () => number };
    pricePerUnit: { toNumber: () => number };
    pricePerBox: { toNumber: () => number } | null;
    isActive: boolean;
    images: Array<{ id: string; url: string; sortOrder: number }>;
  },
  role: Role,
  clientGroupDiscount?: { discountType: string; discountValue: { toNumber: () => number } } | null
) {
  const costPrice = role !== "client" ? Number(v.costPrice) : null;
  const pricePerUnit = Number(v.pricePerUnit);
  const pricePerBox = v.pricePerBox != null ? Number(v.pricePerBox) : null;
  let clientPrice: number | null = null;
  if (role === "client" && clientGroupDiscount) {
    const base = pricePerUnit;
    const val = Number(clientGroupDiscount.discountValue);
    clientPrice =
      clientGroupDiscount.discountType === "percentage"
        ? base * (1 - val / 100)
        : base - val;
    clientPrice = Math.max(0, clientPrice);
  }
  return {
    id: v.id,
    sku: v.sku,
    unitType: v.unitType,
    minOrderQty: v.minOrderQty,
    costPrice,
    pricePerUnit,
    pricePerBox,
    clientPrice,
    images: v.images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
    isActive: v.isActive,
  };
}

export async function listProducts(
  query: PaginationQuery,
  filter: { search?: string; categoryId?: string },
  lang: string,
  user?: AuthUser
) {
  const { rows, total } = await repo.listProducts(query, filter);
  const pagination = paginationMeta(total, query);
  if (!user) {
    return {
      data: rows.map((p) => toPublicProduct(p, lang)),
      pagination,
    };
  }
  const clientGroup = user.clientGroupId
    ? await prisma.clientGroup.findUnique({
        where: { id: user.clientGroupId, deletedAt: null },
      })
    : null;
  return {
    data: rows.map((p) => ({
      id: p.id,
      name: resolveLang(p.name as Multilingual, lang),
      description: resolveLang(p.description as Multilingual, lang),
      category: p.category ? categoryToResponse(p.category, lang) : null,
      variants: p.variants.map((v) =>
        variantToProduct(v, user.role, clientGroup)
      ),
      isActive: p.isActive,
    })),
    pagination,
  };
}

export async function getProductById(
  id: string,
  lang: string,
  user?: AuthUser
) {
  const product = await repo.getProductById(id);
  if (!product) throw new AppError(404, ErrorCodes.NOT_FOUND, "Product not found");
  if (!user) {
    return toPublicProduct(product, lang);
  }
  const clientGroup = user.clientGroupId
    ? await prisma.clientGroup.findUnique({
        where: { id: user.clientGroupId, deletedAt: null },
      })
    : null;
  return {
    id: product.id,
    name: resolveLang(product.name as Multilingual, lang),
    description: resolveLang(product.description as Multilingual, lang),
    category: product.category ? categoryToResponse(product.category, lang) : null,
    variants: product.variants.map((v) =>
      variantToProduct(v, user.role, clientGroup)
    ),
    isActive: product.isActive,
  };
}

/** Returns Category[] only (no pagination wrapper). OpenAPI: GET /catalog/categories -> 200 Category[]. */
export async function listCategoriesArray(lang: string) {
  const rows = await repo.getAllCategories();
  return rows.map((c) => ({
    id: c.id,
    name: resolveLang(c.name as Multilingual, lang),
  }));
}

export async function getCategoryById(id: string, lang: string) {
  const cat = await repo.getCategoryById(id);
  if (!cat) throw new AppError(404, ErrorCodes.NOT_FOUND, "Category not found");
  return {
    id: cat.id,
    name: resolveLang(cat.name as Multilingual, lang),
  };
}

export async function createProduct(
  body: CreateProductBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const product = await repo.createProduct({
    categoryId: body.categoryId ?? null,
    name: body.name,
    description: body.description ?? { en: "" },
    variants: body.variants.map((v) => ({
      sku: v.sku,
      unitType: v.unitType,
      minOrderQty: v.minOrderQty,
      costPrice: v.costPrice,
      pricePerUnit: v.pricePerUnit,
      pricePerBox: v.pricePerBox ?? null,
    })),
  });
  await writeAudit({
    eventType: "catalog.product_created",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "product",
    targetId: product.id,
    payload: { productId: product.id },
    correlationId: opts.correlationId,
  });
  return product;
}

export async function updateProduct(
  id: string,
  body: UpdateProductBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const product = await repo.getProductById(id);
  if (!product) throw new AppError(404, ErrorCodes.NOT_FOUND, "Product not found");
  const updated = await repo.updateProduct(id, {
    name: body.name,
    description: body.description,
    isActive: body.isActive,
    categoryId: body.categoryId,
  });
  await writeAudit({
    eventType: "catalog.product_updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "product",
    targetId: id,
    payload: { productId: id },
    correlationId: opts.correlationId,
  });
  return updated;
}

export async function deleteProduct(
  id: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const product = await repo.getProductById(id);
  if (!product) throw new AppError(404, ErrorCodes.NOT_FOUND, "Product not found");
  const count = await repo.countActiveOrdersWithProduct(id);
  if (count > 0) {
    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      "Cannot delete: product has active orders"
    );
  }
  await repo.deleteProduct(id);
  await writeAudit({
    eventType: "catalog.product_deleted",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "product",
    targetId: id,
    payload: { productId: id },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function createVariant(
  productId: string,
  body: CreateVariantBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const product = await repo.getProductById(productId);
  if (!product) throw new AppError(404, ErrorCodes.NOT_FOUND, "Product not found");
  const variant = await repo.createVariant(productId, {
    sku: body.sku,
    unitType: body.unitType,
    minOrderQty: body.minOrderQty,
    costPrice: body.costPrice,
    pricePerUnit: body.pricePerUnit,
    pricePerBox: body.pricePerBox ?? null,
  });
  await writeAudit({
    eventType: "catalog.variant_created",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variant.id,
    payload: { productId, variantId: variant.id },
    correlationId: opts.correlationId,
  });
  return variant;
}

export async function updateVariant(
  productId: string,
  variantId: string,
  body: UpdateVariantBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const variant = await repo.getVariantById(variantId);
  if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  if (variant.productId !== productId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  }
  if (body.sku != null && body.sku !== variant.sku) {
    const refCount = await repo.countOrdersReferencingVariantSku(variantId);
    if (refCount > 0) {
      throw new AppError(
        409,
        ErrorCodes.CONFLICT,
        "Cannot change SKU: variant is referenced by non-draft orders"
      );
    }
  }
  const updated = await repo.updateVariant(variantId, {
    sku: body.sku,
    unitType: body.unitType,
    minOrderQty: body.minOrderQty,
    costPrice: body.costPrice,
    pricePerUnit: body.pricePerUnit,
    pricePerBox: body.pricePerBox,
    isActive: body.isActive,
  });
  await writeAudit({
    eventType: "catalog.variant_updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variantId,
    payload: { productId, variantId },
    correlationId: opts.correlationId,
  });
  return updated;
}

export async function deleteVariant(
  productId: string,
  variantId: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const variant = await repo.getVariantById(variantId);
  if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  if (variant.productId !== productId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  }
  const activeCount = await repo.countActiveOrdersWithVariant(variantId);
  if (activeCount > 0) {
    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      "Cannot delete: variant has active orders"
    );
  }
  await repo.deleteVariant(variantId);
  await writeAudit({
    eventType: "catalog.variant_deleted",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variantId,
    payload: { productId, variantId },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function addVariantImage(
  productId: string,
  variantId: string,
  body: { url: string },
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const variant = await repo.getVariantById(variantId);
  if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  if (variant.productId !== productId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  }
  const image = await repo.addVariantImage(variantId, body.url);
  await writeAudit({
    eventType: "catalog.variant_image_added",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variantId,
    payload: { productId, variantId, imageId: image.id },
    correlationId: opts.correlationId,
  });
  return image;
}

export async function deleteVariantImage(
  productId: string,
  variantId: string,
  imageId: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const variant = await repo.getVariantById(variantId);
  if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  if (variant.productId !== productId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  }
  const image = await repo.getVariantImage(imageId, variantId);
  if (!image) throw new AppError(404, ErrorCodes.NOT_FOUND, "Image not found");
  await repo.deleteVariantImage(imageId);
  await writeAudit({
    eventType: "catalog.variant_image_removed",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variantId,
    payload: { productId, variantId, imageId },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function reorderVariantImages(
  productId: string,
  variantId: string,
  body: { imageIds: string[] },
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const variant = await repo.getVariantById(variantId);
  if (!variant) throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  if (variant.productId !== productId) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Variant not found");
  }
  const existingIds = new Set(variant.images.map((i) => i.id));
  const unknown = body.imageIds.filter((id) => !existingIds.has(id));
  if (unknown.length > 0) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      "Unknown or duplicate image IDs in reorder list",
      { unknownIds: unknown }
    );
  }
  if (body.imageIds.length !== existingIds.size) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      "Reorder list must contain exactly all variant image IDs"
    );
  }
  await repo.reorderVariantImages(variantId, body.imageIds);
  await writeAudit({
    eventType: "catalog.variant_image_reordered",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "variant",
    targetId: variantId,
    payload: { productId, variantId },
    correlationId: opts.correlationId,
  });
  return {};
}

export async function createCategory(
  body: CreateCategoryBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const category = await repo.createCategory({ name: body.name });
  await writeAudit({
    eventType: "catalog.category_created",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "category",
    targetId: category.id,
    payload: { categoryId: category.id },
    correlationId: opts.correlationId,
  });
  return category;
}

export async function updateCategory(
  id: string,
  body: UpdateCategoryBody,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const category = await repo.getCategoryById(id);
  if (!category) throw new AppError(404, ErrorCodes.NOT_FOUND, "Category not found");
  const updated =
    body.name != null
      ? await repo.updateCategory(id, { name: body.name })
      : category;
  await writeAudit({
    eventType: "catalog.category_updated",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "category",
    targetId: id,
    payload: { categoryId: id },
    correlationId: opts.correlationId,
  });
  return updated;
}

export async function deleteCategory(
  id: string,
  actor: { id: string; role: Role },
  opts: { correlationId?: string }
) {
  if (actor.role !== "super_admin" && actor.role !== "admin") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Forbidden");
  }
  const category = await repo.getCategoryById(id);
  if (!category) throw new AppError(404, ErrorCodes.NOT_FOUND, "Category not found");
  const productCount = await repo.countProductsInCategory(id);
  if (productCount > 0) {
    throw new AppError(
      409,
      ErrorCodes.CONFLICT,
      "Cannot delete: category has products assigned"
    );
  }
  await repo.deleteCategory(id);
  await writeAudit({
    eventType: "catalog.category_deleted",
    actorId: actor.id,
    actorRole: actor.role,
    targetType: "category",
    targetId: id,
    payload: { categoryId: id },
    correlationId: opts.correlationId,
  });
  return {};
}
