import { z } from "zod";
import { payFrequencySchema } from "../types/domain";
import {
  recordId,
  requiredText,
  email,
  optionalDate,
  password,
} from "./common";

export const userFormSchema = z.object({
  userName: requiredText("User name", 120),
  email,
  password: z.string(),
  roleId: z.string(),
  tenantId: z.string(),
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  address: z.string().trim().max(500),
  phoneNumber: z.string().trim().max(40),
  dateOfBirth: optionalDate,
  position: z.string().trim().max(120),
  dateOfHire: optionalDate,
  empContactName: z.string().trim().max(160),
  empPhoneNumber: z.string().trim().max(40),
  bankAcNo: z.string().trim().max(80),
  bankName: z.string().trim().max(120),
  bankAcBranch: z.string().trim().max(120),
  payFrequency: payFrequencySchema,
  notes: z.string().trim().max(2000),
});

export const userDefaults: z.input<typeof userFormSchema> = {
  userName: "",
  email: "",
  password: "",
  roleId: "",
  tenantId: "",
  firstName: "",
  lastName: "",
  address: "",
  phoneNumber: "",
  dateOfBirth: "",
  position: "",
  dateOfHire: "",
  empContactName: "",
  empPhoneNumber: "",
  bankAcNo: "",
  bankName: "",
  bankAcBranch: "",
  payFrequency: "Weekly",
  notes: "",
};

export function accountFormSchema(options: {
  editing: boolean;
  chooseRole: boolean;
  needsSupervisor: (id: string) => boolean;
}) {
  return userFormSchema.superRefine((value, context) => {
    if (!options.editing && !password.safeParse(value.password).success)
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Use a password between 10 and 128 characters",
      });
    if (options.chooseRole && !recordId.safeParse(value.roleId).success)
      context.addIssue({
        code: "custom",
        path: ["roleId"],
        message: "Choose a role",
      });
    if (
      options.chooseRole &&
      options.needsSupervisor(value.roleId) &&
      !recordId.safeParse(value.tenantId).success
    )
      context.addIssue({
        code: "custom",
        path: ["tenantId"],
        message: "Choose a supervisor",
      });
  });
}

export const roleAssignmentSchema = z.object({
  roleId: recordId,
  tenantId: z.union([recordId, z.literal("")]),
});

export type UserValues = z.output<typeof userFormSchema>;

export type RoleAssignment = z.output<typeof roleAssignmentSchema>;
