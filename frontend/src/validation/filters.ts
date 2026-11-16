import { z } from "zod";
import { calendarDate, optionalDate } from "./common";

export const dateRangeSchema = z
  .object({
    startDate: z.union([calendarDate, z.literal("")]),
    endDate: z.union([calendarDate, z.literal("")]),
  })
  .refine(
    (value) =>
      (!value.startDate && !value.endDate) ||
      Boolean(
        value.startDate && value.endDate && value.startDate <= value.endDate,
      ),
    { path: ["endDate"], message: "Choose both dates in order" },
  );

export const optionalDateRangeSchema = z
  .object({ startDate: optionalDate, endDate: optionalDate })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
    { path: ["endDate"], message: "End date must be on or after start date" },
  );
