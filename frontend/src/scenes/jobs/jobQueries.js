import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { jobService } from "./jobService";

export const jobQueryKeys = {
  all: ["jobs"],
  list: (role, userId, filters) => ["jobs", "list", role, userId, filters],
  detail: (id) => ["jobs", "detail", id],
  staffActive: (userId) => ["jobs", "staff-active", userId],
};

export function useJobList(role, userId, filters) {
  return useServiceQuery(
    jobQueryKeys.list(role, userId, filters),
    () => role === "staff"
      ? jobService.getByStaff(userId || "self", filters)
      : jobService.getAllJobs(filters),
    { enabled: Boolean(role) }
  );
}

export function useActiveStaffJob(userId, enabled) {
  return useServiceQuery(
    jobQueryKeys.staffActive(userId),
    () => jobService.getByStaff(userId || "self"),
    { enabled: Boolean(enabled) }
  );
}

export function useUpdateJobStatus() {
  return useServiceMutation(
    ({ id, status }) => jobService.updateStatus(id, { jobStatus: status }),
    { invalidate: [jobQueryKeys.all] }
  );
}

export function useDeleteJob() {
  return useServiceMutation(jobService.remove, { invalidate: [jobQueryKeys.all] });
}

export function useJobAttendance() {
  return useServiceMutation(
    ({ action, id, body }) => jobService.updateAction(action, id, body),
    { invalidate: [jobQueryKeys.all] }
  );
}
