import { z } from "zod";
import { requiredText } from "./common";

export const roleFormSchema = z.object({
  name: requiredText("Role name", 120),
  description: z.string().trim().max(500),
  scope: z.enum(["staff", "tenant"]),
  permissionKeys: z.array(z.string().min(1).max(120)),
  isActive: z.boolean(),
});

export type RoleValues = z.output<typeof roleFormSchema>;
