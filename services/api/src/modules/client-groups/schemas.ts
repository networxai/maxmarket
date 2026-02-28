import { z } from "zod";

const discountTypeEnum = z.enum(["fixed", "percentage"]);

export const listClientGroupsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const createClientGroupBodySchema = z.object({
  name: z.string().min(1),
  discountType: discountTypeEnum,
  discountValue: z.number().min(0),
});

export const updateClientGroupBodySchema = z.object({
  name: z.string().min(1).optional(),
  discountType: discountTypeEnum.optional(),
  discountValue: z.number().min(0).optional(),
});

export const clientGroupIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateClientGroupBody = z.infer<typeof createClientGroupBodySchema>;
export type UpdateClientGroupBody = z.infer<typeof updateClientGroupBodySchema>;
