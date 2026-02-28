/**
 * Users — Zod request/response schemas per OpenAPI.
 */
import { z } from "zod";

const roleEnum = z.enum(["super_admin", "admin", "manager", "agent", "client"]);
const langEnum = z.enum(["en", "hy", "ru"]);

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: roleEnum.optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
});

export const createUserBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(1),
    role: roleEnum,
    preferredLanguage: langEnum.default("en"),
    clientGroupId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "client") return data.clientGroupId != null;
      return true;
    },
    { message: "clientGroupId required when role is client", path: ["clientGroupId"] }
  );

export const updateUserBodySchema = z.object({
  fullName: z.string().min(1).optional(),
  preferredLanguage: langEnum.optional(),
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
  clientGroupId: z.string().uuid().nullable().optional(),
});

export const userIdParamSchema = z.object({ id: z.string().uuid() });
export const agentIdParamSchema = z.object({ agentId: z.string().uuid() });
export const agentClientParamsSchema = z.object({
  agentId: z.string().uuid(),
  clientId: z.string().uuid(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
