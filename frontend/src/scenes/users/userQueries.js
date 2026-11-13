import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { userService } from "../../services/userService";

export const userQueryKeys = {
  all: ["users"],
  list: (params = {}) => ["users", "list", params],
  deleted: (params = {}) => ["users", "deleted", params],
  detail: (id) => ["users", "detail", id],
};

export function useUsers(params = {}, options = {}) {
  return useServiceQuery(userQueryKeys.list(params), () => userService.getAll(params), options);
}

export function useActiveEmployees(options = {}) {
  const params = { scope: "employees", status: "active", limit: 100 };
  return useServiceQuery(userQueryKeys.list(params), () => userService.getAll(params), options);
}

export function useAssignableStaff(options = {}) {
  const params = { scope: "staff", status: "active", limit: 100 };
  return useServiceQuery(userQueryKeys.list(params), () => userService.getAll(params), options);
}

export function useUser(id) {
  return useServiceQuery(userQueryKeys.detail(id), () => userService.getById(id), { enabled: Boolean(id) });
}

export function useCreateUser() {
  return useServiceMutation(userService.create, { invalidate: [userQueryKeys.all] });
}

export function useUpdateUser(id) {
  return useServiceMutation(({ values }) => userService.update(id, values), {
    invalidate: [userQueryKeys.all, userQueryKeys.detail(id)],
  });
}

export function useDeleteUser() {
  return useServiceMutation(userService.remove, { invalidate: [userQueryKeys.all] });
}

export function useUpdateUserStatus() {
  return useServiceMutation(({ id, status }) => userService.updateStatus(id, status), {
    invalidate: [userQueryKeys.all],
  });
}
