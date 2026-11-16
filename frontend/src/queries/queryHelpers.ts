import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
export type ServiceQueryOptions<T> = Omit<
  UseQueryOptions<T, Error>,
  "queryKey" | "queryFn"
>;
export function useServiceQuery<T>(
  queryKey: QueryKey,
  queryFn: () => Promise<T>,
  options: ServiceQueryOptions<T> = {},
) {
  return useQuery({ queryKey, queryFn, ...options });
}
type MutationOptions<T, V> = Omit<
  UseMutationOptions<T, Error, V>,
  "mutationFn"
> & { invalidate?: QueryKey[] };
export function useServiceMutation<T, V = void>(
  mutationFn: (variables: V) => Promise<T>,
  options: MutationOptions<T, V> = {},
) {
  const queryClient = useQueryClient();
  const { invalidate = [], onSuccess, ...rest } = options;
  return useMutation({
    mutationFn,
    ...rest,
    onSuccess: async (data, variables, result, context) => {
      await Promise.all(
        invalidate.map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
      await onSuccess?.(data, variables, result, context);
    },
  });
}
