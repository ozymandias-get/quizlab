import {
    useQuery,
    useMutation,
    UseQueryOptions,
    UseMutationOptions,
    QueryKey
} from '@tanstack/react-query'
import { useToast } from '@src/app/providers/ToastContext'

// Helper to access API safely
export const getApi = () => {
    if (typeof window === 'undefined' || !window.electronAPI) {
        throw new Error('Electron API is not available')
    }
    return window.electronAPI
}

/**
 * Base hook for Electron queries
 */
export function useElectronQuery<TData = unknown>(
    options: {
        key: QueryKey,
        queryFn: (api: typeof window.electronAPI) => Promise<TData>,
        options?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'>
    }
) {
    return useQuery({
        queryKey: options.key,
        queryFn: () => options.queryFn(getApi()),
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
    }
) {
    const { showError } = useToast()

    return useMutation({
        mutationFn: (variables) => mutationFn(getApi(), variables),
        ...options,
        onError: (error, variables, context) => {
            if (options?.onError) {
                // @ts-ignore - Suppress lint error about argument count
                (options.onError as any)(error, variables, context)
            }
            // Explicitly pass undefined for optional parameters to satisfy strict linter checks
            showError(options?.errorMessage || (error as Error).message || 'An error occurred', 'Mutation Error', undefined, undefined)
        }
    })
}

