import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
  QueryKey
} from '@tanstack/react-query'
import { useToastActions } from '@app/providers/ToastContext'
import { getElectronApi } from '@shared/lib/electronApi'
import type { ElectronApi } from '@shared-core/types/ipcContract'

/**
 * Base hook for Electron queries
 */
export function useElectronQuery<TData = unknown>(options: {
  key: QueryKey
  queryFn: (api: ElectronApi) => Promise<TData>
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
  mutationFn: (api: ElectronApi, variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables> & {
    errorMessage?: string
    showErrorToast?: boolean
  }
) {
  const { showError } = useToastActions()

  return useMutation({
    mutationFn: (variables) => mutationFn(getElectronApi(), variables),
    ...options,
    onError: (error, variables, context) => {
      if (options?.onError) {
        ;(options.onError as (err: Error, variables: TVariables, context: unknown) => void)(
          error,
          variables,
          context
        )
      }
      if (options?.showErrorToast !== false) {
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
