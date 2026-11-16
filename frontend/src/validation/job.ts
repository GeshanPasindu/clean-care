import { z } from "zod";
import { recordId, requiredText, numberInput, dateTime } from "./common";

const jobShape = {
  jobName: requiredText("Job name"),
  description: requiredText("Description", 10000),
  client: recordId,
  assignedStaff: z
    .array(recordId)
    .min(1, "Select at least one staff member")
    .max(50)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Duplicate staff assignments",
    ),
  staffRates: z.record(recordId, numberInput),
  orgNoOfhours: numberInput,
  orgHourRate: numberInput,
  estNoOfhours: numberInput,
  notes: z.string().trim().max(2000),
  jobDate: z.union([dateTime, z.literal("")]),
};

export const jobFormSchema = z
  .object(jobShape)
  .superRefine((value, context) => {
    for (const id of value.assignedStaff) {
      if (value.staffRates[id] === undefined)
        context.addIssue({
          code: "custom",
          path: ["staffRates", id],
          message: "Enter this cleaner's hourly pay",
        });
    }
    for (const id of Object.keys(value.staffRates)) {
      if (!value.assignedStaff.includes(id))
        context.addIssue({
          code: "custom",
          path: ["staffRates", id],
          message: "Rates must belong to assigned staff",
        });
    }
  });

export const jobDefaults: z.input<typeof jobFormSchema> = {
  jobName: "",
  description: "",
  client: "",
  assignedStaff: [],
  staffRates: {},
  orgNoOfhours: "",
  orgHourRate: "",
  estNoOfhours: "",
  notes: "",
  jobDate: "",
};

export type JobValues = z.output<typeof jobFormSchema>;
