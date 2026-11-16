import { z } from "zod";
import { email, requiredText } from "./common";

export const clientFormSchema = z.object({
  firstName: requiredText("First name", 100),
  lastName: z.string().trim().max(100),
  email,
  address: requiredText("Address", 500),
  phoneNumber: requiredText("Phone number", 40),
  contactName: z.string().trim().max(160),
  contactPhoneNumber: z.string().trim().max(40),
  contactEmail: z.union([email, z.literal("")]),
  accountManager: z.string().trim().max(160),
  notes: z.string().trim().max(2000),
});

export const clientDefaults: z.input<typeof clientFormSchema> = {
  firstName: "",
  lastName: "",
  email: "",
  address: "",
  phoneNumber: "",
  contactName: "",
  contactPhoneNumber: "",
  contactEmail: "",
  accountManager: "",
  notes: "",
};

export type ClientValues = z.output<typeof clientFormSchema>;
