import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useServiceQuery(queryKey, queryFn, options = {}) {
  return useQuery({ queryKey, queryFn, ...options });
}

export function useServiceMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient();
  const { invalidate = [], onSuccess, ...mutationOptions } = options;

  return useMutation({
    mutationFn,
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      await Promise.all(
        invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
      return onSuccess?.(data, variables, context);
    },
  });
}
