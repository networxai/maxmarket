import { z } from "zod";

/** Accepts date-only (YYYY-MM-DD) or full ISO datetime per OpenAPI format: date */
const dateParam = z
  .string()
  .refine((s) => !isNaN(new Date(s).getTime()), { message: "Invalid date" })
  .optional();

export const salesByDateQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: dateParam,
  dateTo: dateParam,
});

export const salesByManagerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  dateFrom: dateParam,
  dateTo: dateParam,
});

export const salesByClientQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  clientId: z.string().uuid().optional(),
  dateFrom: dateParam,
  dateTo: dateParam,
});

export const salesByProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  variantId: z.string().uuid().optional(),
  dateFrom: dateParam,
  dateTo: dateParam,
});

export const exportReportQuerySchema = z.object({
  reportType: z.enum(["sales-by-date", "sales-by-manager", "sales-by-client", "sales-by-product"]),
  format: z.enum(["csv", "pdf"]).default("csv"),
  dateFrom: dateParam,
  dateTo: dateParam,
  clientId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
});
