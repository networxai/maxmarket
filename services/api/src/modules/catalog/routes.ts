/**
 * Catalog — public GET (no auth) + optional auth for price shape; admin CRUD.
 */
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { authMiddleware, type AuthenticatedRequest } from "../../auth/auth-middleware.js";
import { optionalAuth, type RequestWithOptionalUser } from "../../auth/optional-auth.js";
import { requireRoles } from "../../auth/rbac.js";
import { CORRELATION_ID_HEADER } from "../../lib/constants.js";
import { buildErrorEnvelope, ErrorCodes } from "../../lib/errors.js";
import { zodDetailsToStable } from "../../lib/zod-details.js";
import { parsePaginationQuery } from "../../lib/pagination.js";
import * as service from "./service.js";
import {
  listProductsQuerySchema,
  productIdParamSchema,
  productIdOnlyParamSchema,
  productVariantParamsSchema,
  productVariantImageParamsSchema,
  createProductBodySchema,
  updateProductBodySchema,
  createVariantBodySchema,
  updateVariantBodySchema,
  createCategoryBodySchema,
  updateCategoryBodySchema,
  categoryIdParamSchema,
  addVariantImageBodySchema,
  reorderVariantImagesBodySchema,
} from "./schemas.js";

const ACCEPT_LANG = "accept-language";
const DEFAULT_LANG = "en";

function getLang(headers: { [key: string]: string | undefined }): string {
  const v = headers[ACCEPT_LANG] ?? headers["accept-language"];
  if (typeof v !== "string") return DEFAULT_LANG;
  const lang = v.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return lang === "hy" || lang === "ru" ? lang : DEFAULT_LANG;
}

export async function catalogRoutes(
  fastify: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  const setCorrelation = (reply: { header: (k: string, v: string) => unknown }, cid: string) => {
    reply.header(CORRELATION_ID_HEADER, cid);
  };

  fastify.get<{
    Querystring: { page?: string; pageSize?: string; search?: string; category?: string };
  }>(
    "/catalog/products",
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const req = request as RequestWithOptionalUser;
      const parsed = listProductsQuerySchema.safeParse({
        page: request.query?.page,
        pageSize: request.query?.pageSize,
        search: request.query?.search,
        category: request.query?.category,
      });
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const query = parsePaginationQuery(parsed.data.page, parsed.data.pageSize);
      const lang = getLang(request.headers as { [key: string]: string | undefined });
      const result = await service.listProducts(
        query,
        { search: parsed.data.search, categoryId: parsed.data.category },
        lang,
        req.user
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(result);
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/catalog/products/:id",
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const req = request as RequestWithOptionalUser;
      const parsed = productIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const lang = getLang(request.headers as { [key: string]: string | undefined });
      const product = await service.getProductById(parsed.data.id, lang, req.user);
      setCorrelation(reply, req.correlationId);
      return reply.send(product);
    }
  );

  fastify.get("/catalog/categories", async (request, reply) => {
    const correlationId = (request as { correlationId: string }).correlationId;
    const lang = getLang(request.headers as { [key: string]: string | undefined });
    const categories = await service.listCategoriesArray(lang);
    setCorrelation(reply, correlationId);
    return reply.send(categories);
  });

  fastify.post<{ Body: unknown }>(
    "/catalog/products",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createProductBodySchema.safeParse(request.body);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const product = await service.createProduct(parsed.data, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(product);
    }
  );

  fastify.put<{ Params: { id: string }; Body: unknown }>(
    "/catalog/products/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = productIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = updateProductBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const product = await service.updateProduct(
        paramParsed.data.id,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(product);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/catalog/products/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = productIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      await service.deleteProduct(parsed.data.id, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  // ─── Variants (admin) ─────────────────────────────────────────────────────
  fastify.post<{ Params: { productId: string }; Body: unknown }>(
    "/catalog/products/:productId/variants",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = productIdOnlyParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = createVariantBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const variant = await service.createVariant(
        paramParsed.data.productId,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(variant);
    }
  );

  fastify.put<{ Params: { productId: string; variantId: string }; Body: unknown }>(
    "/catalog/products/:productId/variants/:variantId",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = productVariantParamsSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = updateVariantBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const variant = await service.updateVariant(
        paramParsed.data.productId,
        paramParsed.data.variantId,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(variant);
    }
  );

  fastify.delete<{ Params: { productId: string; variantId: string } }>(
    "/catalog/products/:productId/variants/:variantId",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = productVariantParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      await service.deleteVariant(
        parsed.data.productId,
        parsed.data.variantId,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  // ─── Variant images (admin) ───────────────────────────────────────────────
  fastify.post<{ Params: { productId: string; variantId: string }; Body: unknown }>(
    "/catalog/products/:productId/variants/:variantId/images",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = productVariantParamsSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = addVariantImageBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const image = await service.addVariantImage(
        paramParsed.data.productId,
        paramParsed.data.variantId,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(image);
    }
  );

  fastify.delete<{ Params: { productId: string; variantId: string; imageId: string } }>(
    "/catalog/products/:productId/variants/:variantId/images/:imageId",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = productVariantImageParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      await service.deleteVariantImage(
        parsed.data.productId,
        parsed.data.variantId,
        parsed.data.imageId,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  fastify.put<{ Params: { productId: string; variantId: string }; Body: unknown }>(
    "/catalog/products/:productId/variants/:variantId/images/reorder",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = productVariantParamsSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = reorderVariantImagesBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      await service.reorderVariantImages(
        paramParsed.data.productId,
        paramParsed.data.variantId,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );

  // ─── Categories admin ─────────────────────────────────────────────────────
  fastify.post<{ Body: unknown }>(
    "/catalog/categories",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createCategoryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      const category = await service.createCategory(parsed.data, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(201).send(category);
    }
  );

  fastify.put<{ Params: { id: string }; Body: unknown }>(
    "/catalog/categories/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const paramParsed = categoryIdParamSchema.safeParse(request.params);
      if (!paramParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(paramParsed.error)
          )
        );
      }
      const bodyParsed = updateCategoryBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(bodyParsed.error)
          )
        );
      }
      const category = await service.updateCategory(
        paramParsed.data.id,
        bodyParsed.data,
        req.user,
        { correlationId: req.correlationId }
      );
      setCorrelation(reply, req.correlationId);
      return reply.send(category);
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/catalog/categories/:id",
    { preHandler: [authMiddleware, requireRoles("super_admin", "admin")] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = categoryIdParamSchema.safeParse(request.params);
      if (!parsed.success) {
        setCorrelation(reply, req.correlationId);
        return reply.status(422).send(
          buildErrorEnvelope(
            ErrorCodes.VALIDATION_ERROR,
            "Validation failed",
            req.correlationId,
            zodDetailsToStable(parsed.error)
          )
        );
      }
      await service.deleteCategory(parsed.data.id, req.user, {
        correlationId: req.correlationId,
      });
      setCorrelation(reply, req.correlationId);
      return reply.status(200).send();
    }
  );
}
