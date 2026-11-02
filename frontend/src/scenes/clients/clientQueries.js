import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientService } from "./clientService";

export const clientQueryKeys = {
  all: ["clients"],
  list: () => ["clients", "list"],
  active: () => ["clients", "active"],
  detail: (id) => ["clients", "detail", id],
  jobs: (id, filters) => ["clients", id, "jobs", filters],
};

export function useClients(options = {}) {
  return useQuery({
    queryKey: clientQueryKeys.list(),
    queryFn: clientService.getAll,
    ...options,
  });
}

export function useActiveClients(options = {}) {
  return useQuery({
    queryKey: clientQueryKeys.active(),
    queryFn: clientService.getAllActive,
    ...options,
  });
}

export function useClient(id) {
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientQueryKeys.all }),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }) => clientService.update(id, values),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientQueryKeys.all }),
  });
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => clientService.updateStatus(id, status),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.detail(id) });
    },
  });
}
