import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { adminService } from "../../services/adminService";
import { userService } from "../../services/userService";

export const adminQueryKeys = {
  all: ["admins"],
  list: () => ["admins", "list"],
  detail: (id) => ["users", "detail", id],
};

export function useAdmins() {
  return useServiceQuery(adminQueryKeys.list(), adminService.getAll);
}

export function useDeleteAdmin() {
  return useServiceMutation(userService.remove, { invalidate: [adminQueryKeys.all] });
}

export function useChangeAdminStatus() {
  return useServiceMutation(
    ({ id, status }) => adminService.updateStatus(id, status),
    { invalidate: [adminQueryKeys.all] }
  );
}
