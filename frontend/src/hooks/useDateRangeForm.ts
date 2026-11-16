import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { dateRangeSchema } from "../validation/forms";

export function useDateRangeForm() {
  const form = useForm<{ startDate: string; endDate: string }>({
    defaultValues: { startDate: "", endDate: "" },
    resolver: zodResolver(dateRangeSchema),
    mode: "onChange",
  });
  const { startDate, endDate } = form.watch();
  return {
    ...form,
    startDate,
    endDate,
    setStartDate: (value: string) => form.setValue("startDate", value),
    setEndDate: (value: string) => form.setValue("endDate", value),
  };
}
