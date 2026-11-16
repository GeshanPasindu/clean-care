import { z } from "zod";

export const recordId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Select a valid record");

export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

export const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128);

export const numberInput = z
  .union([z.number(), z.string().trim().min(1, "Enter a number")])
  .transform(Number)
  .pipe(z.number().finite().min(0, "Use zero or a positive number"));

export const calendarDate = z.iso.date("Enter a valid date");

export const optionalDate = z.union([calendarDate, z.literal("")]);

export const dateTime = z.union([
  calendarDate,
  z.iso.datetime({ local: true, offset: true }),
]);
