import { z } from "zod";
import { payFrequencies } from "../types/domain.js";
import {
  accountStatusSchema,
  emailSchema,
  nullableDateSchema,
  optionalIdSchema,
  passwordSchema,
  paginationQuerySchema,
  objectIdSchema,
} from "./common.js";

const profileShape = {
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  userName: z.string().trim().min(1).max(120),
  email: emailSchema,
  address: z.string().trim().max(500).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  dateOfBirth: nullableDateSchema,
  position: z.string().trim().max(120).optional(),
  empContactName: z.string().trim().max(160).optional(),
  empPhoneNumber: z.string().trim().max(40).optional(),
  bankAcNo: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  bankAcBranch: z.string().trim().max(120).optional(),
};
export const updateProfileBodySchema = z.object(profileShape).partial();
export const createUserBodySchema = z.object({
  ...profileShape,
  password: passwordSchema,
  roleId: optionalIdSchema,
  tenantId: optionalIdSchema,
  dateOfHire: nullableDateSchema,
  payFrequency: z.enum(payFrequencies).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateUserBodySchema = createUserBodySchema
  .omit({ password: true, roleId: true, tenantId: true })
  .partial()
  .extend({
    roleId: z.never().optional(),
    tenantId: z.never().optional(),
  });
export const changeRoleBodySchema = z.object({
  roleId: objectIdSchema,
  tenantId: optionalIdSchema,
});
export const userStatusBodySchema = z.object({ status: accountStatusSchema });
export const resetPasswordBodySchema = z.object({ password: passwordSchema });
export const userListQuerySchema = paginationQuerySchema.extend({
  scope: z.enum(["platform", "tenant", "staff", "employees"]).optional(),
  roleId: optionalIdSchema,
  status: accountStatusSchema.optional(),
});
export const userCountQuerySchema = z.object({
  scope: z
    .enum(["platform", "tenant", "staff", "employees"])
    .default("employees"),
});
