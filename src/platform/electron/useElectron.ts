import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey
} from '@tanstack/react-query'
import { useToast } from '@app/providers/ToastContext'
import { getElectronApi } from '@shared/lib/electronApi'

/**
 * Base hook for Electron queries
 */
export function useElectronQuery<TData = unknown>(options: {
  key: QueryKey
  queryFn: (api: typeof window.electronAPI) => Promise<TData>
  options?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>
}) {
  return useQuery({
    queryKey: options.key,
    queryFn: () => options.queryFn(getElectronApi()),
    ...options.options
  })
}

/**
 * Base hook for Electron mutations with centralized error handling
 */
export function useElectronMutation<TData = unknown, TVariables = void>(
  mutationFn: (api: typeof window.electronAPI, variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & {
    errorMessage?: string
    showErrorToast?: boolean
  }
) {
  const { showError } = useToast()

  return useMutation({
    mutationFn: (variables) => mutationFn(getElectronApi(), variables),
    ...options,
    onError: (error, variables, context) => {
      if (options?.onError) {
        // @ts-expect-error - React Query callback provides 3 args but internal options type may expect 4
        options.onError(error, variables, context)
      }
      if (options?.showErrorToast !== false) {
        // Explicitly pass undefined for optional parameters to satisfy strict linter checks
        showError(
          options?.errorMessage || (error as Error).message || 'An error occurred',
          'Mutation Error',
          undefined,
          undefined
        )
      }
    }
  })
}
