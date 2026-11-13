import { clientService } from "../scenes/clients/clientService";
import { jobService } from "../scenes/jobs/jobService";
import { userService } from "./userService";

export const dashboardService = {
  async getMetrics() {
    const [staff, clients, jobs, totals] = await Promise.all([
      userService.getCount("employees"),
      clientService.getCount(),
      jobService.getCount(),
      jobService.getTotalAndProfit(),
    ]);
    const financials = totals.data || {};

    return {
      staff: staff.count || 0,
      clients: clients.count || 0,
      jobs: jobs.count || 0,
      totalPayments: financials.totalOrgTotal || 0,
      staffPayments: financials.totalStaffPayTotal || 0,
      profit: financials.totalProfit || 0,
    };
  },
};
