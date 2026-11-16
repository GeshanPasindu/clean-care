import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import type { QueryParams } from "../../types/api";
import type { JobStatus } from "../../types/domain";
import type { AttendanceAction, AttendanceInput } from "../../types/requests";
import { jobService } from "./jobService";

export const jobQueryKeys = {
  all: ["jobs"],
  list: (
    role: string | undefined,
    userId: string | undefined,
    filters: QueryParams,
  ) => ["jobs", "list", role, userId, filters],
  detail: (id: string | undefined) => ["jobs", "detail", id],
  staffActive: (userId: string | undefined) => ["jobs", "staff-active", userId],
};

export function useJobList(
  role: string | undefined,
  userId: string | undefined,
  filters: QueryParams,
) {
  return useServiceQuery(
    jobQueryKeys.list(role, userId, filters),
    () =>
      role === "staff"
        ? jobService.getByStaff(userId || "self", filters)
        : jobService.getAllJobs(filters),
    { enabled: Boolean(role) },
  );
}

export function useActiveStaffJob(
  userId: string | undefined,
  enabled: boolean,
) {
  return useServiceQuery(
    jobQueryKeys.staffActive(userId),
    () => jobService.getByStaff(userId || "self"),
    { enabled: Boolean(enabled) },
  );
}

export function useUpdateJobStatus() {
  return useServiceMutation(
    ({ id, status }: { id: string; status: JobStatus }) =>
      jobService.updateStatus(id, { jobStatus: status }),
    { invalidate: [jobQueryKeys.all] },
  );
}

export function useDeleteJob() {
  return useServiceMutation(jobService.remove, {
    invalidate: [jobQueryKeys.all],
  });
}

export function useJobAttendance() {
  return useServiceMutation(
    ({
      action,
      id,
      body,
    }: {
      action: AttendanceAction;
      id: string;
      body: AttendanceInput;
    }) => jobService.updateAction(action, id, body),
    { invalidate: [jobQueryKeys.all] },
  );
}
