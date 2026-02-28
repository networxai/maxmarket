import { z } from "zod";

export const listStockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  warehouseId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
});

export const adjustStockBodySchema = z.object({
  warehouseId: z.string().uuid(),
  variantId: z.string().uuid(),
  newAvailableQty: z.number().int().min(0),
  reason: z.string().min(1),
});
