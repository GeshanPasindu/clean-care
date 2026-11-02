import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { staffService } from "../../services/staffService";

export const staffQueryKeys = {
  all: ["staff"],
  list: () => ["staff", "list"],
  active: () => ["staff", "active"],
  detail: (id) => ["staff", "detail", id],
};

export function useStaff(options = {}) {
  return useServiceQuery(staffQueryKeys.list(), staffService.getAll, options);
}

export function useActiveStaff(options = {}) {
  return useServiceQuery(staffQueryKeys.active(), staffService.getAllActive, options);
}

export function useStaffById(id) {
  return useServiceQuery(staffQueryKeys.detail(id), () => staffService.getById(id), {
    enabled: Boolean(id),
  });
}

export function useDeleteStaff() {
  return useServiceMutation(staffService.remove, { invalidate: [staffQueryKeys.all] });
}

export function useChangeStaffStatus() {
  return useServiceMutation(
    ({ id, status }) => staffService.updateStatus(id, status),
    { invalidate: [staffQueryKeys.all] }
  );
}
