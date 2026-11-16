import { z } from "zod";
import {
  accountStatusSchema,
  emailSchema,
  paginationQuerySchema,
  queryIntegerSchema,
} from "./common.js";

const clientLastNameSchema = z.string().trim().max(100);

export const createClientBodySchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: clientLastNameSchema.default(""),
  email: emailSchema,
  address: z.string().trim().min(1).max(500),
  phoneNumber: z.string().trim().min(1).max(40),
  contactName: z.string().trim().max(160).optional(),
  contactPhoneNumber: z.string().trim().max(40).optional(),
  contactEmail: z.union([emailSchema, z.literal("")]).optional(),
  accountManager: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export const updateClientBodySchema = createClientBodySchema.partial().extend({
  lastName: clientLastNameSchema.optional(),
});
export const clientStatusBodySchema = z.object({
  clientStatus: accountStatusSchema,
});
export const clientListQuerySchema = paginationQuerySchema.extend({
  limit: queryIntegerSchema(100).default(10),
});
