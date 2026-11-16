import { z } from "zod";

export const createRoleBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  key: z.string().trim().min(1).max(64).optional(),
  description: z.string().trim().max(500).default(""),
  scope: z.enum(["tenant", "staff"]),
  permissionKeys: z.array(z.string().min(1).max(120)).default([]),
});
export const updateRoleBodySchema = createRoleBodySchema
  .pick({ name: true, description: true, permissionKeys: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
export const roleListQuerySchema = z.object({
  includeInactive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});
