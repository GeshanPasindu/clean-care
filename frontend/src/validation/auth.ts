import { z } from "zod";
import { email, password, requiredText } from "./common";

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(256),
});
export const firstLoginSchema = z
  .object({
    temporaryPassword: z
      .string()
      .min(1, "Temporary password is required")
      .max(128),
    newPassword: password,
    confirmPassword: z.string().min(1, "Confirm your new password").max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  })
  .refine((value) => value.newPassword !== value.temporaryPassword, {
    path: ["newPassword"],
    message: "Choose a different password from the temporary password",
  });
export type FirstLoginValues = z.output<typeof firstLoginSchema>;

export const profileFormSchema = z.object({
  userName: requiredText("Display name", 120),
  email,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(256),
    newPassword: password,
    confirmPassword: z.string().min(1, "Confirm password is required").max(128),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords must match",
  });

export const workDescriptionSchema = z.object({
  description: requiredText("Work description", 1000),
});

export type LoginValues = z.output<typeof loginSchema>;

export type ProfileValues = z.output<typeof profileFormSchema>;

export type ChangePasswordValues = Pick<
  z.output<typeof changePasswordSchema>,
  "currentPassword" | "newPassword"
>;
