import { useQueryClient } from "@tanstack/react-query";
export const paymentKeys = {
  all: ["employee-payments"] as const,
  employees: (scope: string, page: number, search: string) =>
    ["employee-payments", "employees", scope, page, search] as const,
  list: (scope: string, page: number, employeeId: string, status: string) =>
    ["employee-payments", "list", scope, page, employeeId, status] as const,
  receipts: (page: number) => ["employee-payments", "receipts", page] as const,
};
export function useRefreshPayments() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: paymentKeys.all }),
      client.invalidateQueries({ queryKey: ["jobs"] }),
      client.invalidateQueries({ queryKey: ["staff-jobs"] }),
    ]);
  };
}
