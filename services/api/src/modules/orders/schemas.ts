import { z } from "zod";

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "submitted", "approved", "rejected", "fulfilled", "cancelled", "returned"]).optional(),
  clientId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
});

export const orderIdParamSchema = z.object({ id: z.string().uuid() });
export const orderVersionParamsSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.coerce.number().int().min(1),
});
export const orderIdLineItemParamSchema = z.object({
  orderId: z.string().uuid(),
  lineItemId: z.string().uuid(),
});

export const createOrderBodySchema = z.object({
  clientId: z.string().uuid(),
  notes: z.string().optional(),
  lineItems: z.array(
    z.object({
      variantId: z.string().uuid(),
      warehouseId: z.string().uuid().optional(),
      qty: z.number().int().min(1),
    })
  ).min(1),
});

export const updateOrderBodySchema = z.object({
  notes: z.string().optional(),
  lineItems: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        warehouseId: z.string().uuid().optional(),
        qty: z.number().int().min(1),
      })
    )
    .min(1)
    .optional(),
  versionLock: z.number().int().min(0).optional(),
});

export const overridePriceBodySchema = z.object({
  managerOverride: z.number().min(0),
});
