import { z } from "zod";

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  eventType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  includeCleared: z.coerce.boolean().default(false),
});

export const clearAuditLogsBodySchema = z.object({
  scope: z.literal("before_date"),
  beforeDate: z.string().datetime(),
});
