import type { ServiceQueryOptions } from "../../queries/queryHelpers";
import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { userService } from "../../services/userService";
import type { QueryParams } from "../../types/api";
import type { AccountStatus } from "../../types/domain";
import type { UpdateUserInput } from "../../types/requests";

export const userQueryKeys = {
  all: ["users"],
  list: (params: QueryParams = {}) => ["users", "list", params],
  deleted: (params: QueryParams = {}) => ["users", "deleted", params],
  detail: (id: string | undefined) => ["users", "detail", id],
};

export function useUsers(
  params: QueryParams = {},
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof userService.getAll>>
  > = {},
) {
  return useServiceQuery(
    userQueryKeys.list(params),
    () => userService.getAll(params),
    options,
  );
}

export function useActiveEmployees(
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof userService.getAll>>
  > = {},
) {
  const params = { scope: "employees", status: "active", limit: 100 };
  return useServiceQuery(
    userQueryKeys.list(params),
    () => userService.getAll(params),
    options,
  );
}

export function useAssignableStaff(
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof userService.getAll>>
  > = {},
) {
  const params = { scope: "staff", status: "active", limit: 100 };
  return useServiceQuery(
    userQueryKeys.list(params),
    () => userService.getAll(params),
    options,
  );
}

export function useUser(id: string | undefined) {
  return useServiceQuery(
    userQueryKeys.detail(id),
    () => userService.getById(id),
    { enabled: Boolean(id) },
  );
}

export function useCreateUser() {
  return useServiceMutation(userService.create, {
    invalidate: [userQueryKeys.all],
  });
}

export function useUpdateUser(id: string | undefined) {
  return useServiceMutation(
    ({ values }: { values: UpdateUserInput }) => userService.update(id, values),
    {
      invalidate: [userQueryKeys.all, userQueryKeys.detail(id)],
    },
  );
}

export function useDeleteUser() {
  return useServiceMutation(userService.remove, {
    invalidate: [userQueryKeys.all],
  });
}

export function useUpdateUserStatus() {
  return useServiceMutation(
    ({ id, status }: { id: string; status: AccountStatus }) =>
      userService.updateStatus(id, status),
    {
      invalidate: [userQueryKeys.all],
    },
  );
}
