import type { PayoutFrequency } from "../types/payments.js";
const dayMs = 86400000;
const colomboOffset = 330 * 60000;
export function paymentPeriod(
  date: string,
  frequency: Exclude<PayoutFrequency, "PerJob">,
) {
  const selected = new Date(`${date}T00:00:00Z`);
  let start = selected.getTime();
  let end = start + dayMs;
  if (frequency === "Weekly") {
    start -= ((selected.getUTCDay() + 6) % 7) * dayMs;
    end = start + 7 * dayMs;
  } else if (frequency === "Monthly") {
    start = Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1);
    end = Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 1);
  }
  return {
    periodStart: new Date(start - colomboOffset),
    periodEnd: new Date(end - colomboOffset - 1),
  };
}
export function paymentDay(value: Date): string {
  return new Date(value.getTime() + colomboOffset).toISOString().slice(0, 10);
}
