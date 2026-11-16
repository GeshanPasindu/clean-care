import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServiceQueryOptions } from "../../queries/queryHelpers";
import type { QueryParams } from "../../types/api";
import type { AccountStatus } from "../../types/domain";
import type { ClientValues } from "../../validation/forms";
import { clientService } from "./clientService";

export const clientQueryKeys = {
  all: ["clients"],
  list: () => ["clients", "list"],
  active: () => ["clients", "active"],
  detail: (id: string | undefined) => ["clients", "detail", id],
  jobs: (id: string | undefined, filters: QueryParams) => [
    "clients",
    id,
    "jobs",
    filters,
  ],
};

export function useClients(
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof clientService.getAll>>
  > = {},
) {
  return useQuery({
    queryKey: clientQueryKeys.list(),
    queryFn: clientService.getAll,
    ...options,
  });
}

export function useClientPage(
  params: QueryParams = {},
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof clientService.getPaginated>>
  > = {},
) {
  return useQuery({
    queryKey: ["clients", "page", params],
    queryFn: () => clientService.getPaginated(params),
    ...options,
  });
}

export function useActiveClients(
  options: ServiceQueryOptions<
    Awaited<ReturnType<typeof clientService.getAllActive>>
  > = {},
) {
  return useQuery({
    queryKey: clientQueryKeys.active(),
    queryFn: clientService.getAllActive,
    ...options,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: clientQueryKeys.detail(id),
    queryFn: () => clientService.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientService.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.all }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string | undefined;
      values: ClientValues;
    }) => clientService.update(id, values),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.detail(id) });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: clientService.remove,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.all }),
  });
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AccountStatus }) =>
      clientService.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.detail(id) });
    },
  });
}
