import { z } from "zod";
import type { AuthenticatedUser } from "../types/domain.js";
import { roleScopes, accountStatuses } from "../types/domain.js";
import { emailSchema, objectIdSchema, passwordSchema } from "./common.js";

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});
export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});
export const completeFirstLoginSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    temporaryPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((value) => value.newPassword !== value.temporaryPassword, {
    path: ["newPassword"],
    message: "Choose a different password from the temporary password",
  });
export const accessTokenPayloadSchema = z.object({
  sub: objectIdSchema,
  sid: objectIdSchema,
  jti: z.string().optional(),
});
export const authenticatedUserSchema: z.ZodType<AuthenticatedUser> = z.object({
  id: objectIdSchema,
  _id: objectIdSchema,
  userName: z.string(),
  email: z.string(),
  role: z.string(),
  roleId: objectIdSchema,
  roleName: z.string(),
  scope: z.enum(roleScopes),
  isPlatformAdmin: z.boolean(),
  permissions: z.array(z.string()),
  status: z.enum(accountStatuses),
  firstName: z.string(),
  lastName: z.string(),
  address: z.string(),
  phoneNumber: z.string(),
  dateOfBirth: z.date().nullable(),
  position: z.string(),
  tenantId: objectIdSchema.nullable(),
  supervisor: z.object({ id: objectIdSchema, name: z.string() }).nullable(),
  supervisorName: z.string(),
  isDeleted: z.boolean(),
});
export const refreshCookiesSchema = z.object({
  cc_refresh: z.string().max(256).optional(),
});
