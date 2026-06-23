import type { ElectronApi } from '@shared-core/types/ipcContract'

import { getElectronApi } from '@shared/lib/electronApi'
import { useToastActions } from '@shared/stores/toastStore'

import {
  type QueryKey,
  useMutation,
  type UseMutationOptions,
  useQuery,
  type UseQueryOptions
} from '@tanstack/react-query'

// SECURITY: Patterns to redact from error messages before displaying them
// in the UI.  Raw system error messages (ENOENT, EACCES, etc.) often contain
// absolute filesystem paths (e.g. "/Users/alice/Library/...", "C:\Users\bob\...")
// that leak the user's home directory name and system structure.
const ERROR_PATH_PATTERNS: RegExp[] = [
  // Unix absolute paths
  /(?:\/[^\s):]+){2,}/g,
  // Windows absolute paths (drive letters)
  /[A-Za-z]:(?:\\[^\s):]+){2,}/g,
  // Windows UNC paths
  /\\{2}[^\s):]+(?:\\[^\s):]+)+/g
]

/**
 * Sanitise a raw error message by removing filesystem paths that could
 * disclose the user's home directory name, application structure, or
 * system configuration.  Returns a user-safe generic message when paths
 * are detected, or the original message if it contains no paths.
 */
function sanitizeErrorMessage(raw: string): string {
  let sanitized = raw
  for (const pattern of ERROR_PATH_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[path]')
  }
  if (sanitized !== raw) {
    // At least one path was redacted — return a generic message to avoid
    // leaking partial path info through context clues in the remaining text.
    return 'An unexpected error occurred. Please check file permissions and try again.'
  }
  return sanitized
}

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
    // SECURITY: Gracefully handle missing Electron API (browser, test, SSR).
    // Previously, getElectronApi() threw a hard error that crashed the entire
    // React component tree, resulting in a White Screen of Death.
    queryFn: () => {
      const api = getElectronApi()
      if (!api) return Promise.reject(new Error('Electron API is not available'))
      return options.queryFn(api)
    },
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
    // SECURITY: Gracefully handle missing Electron API. Instead of crashing
    // the entire component tree with an uncaught throw, reject the mutation
    // so React Query's error handling can display a user-friendly message.
    mutationFn: (variables) => {
      const api = getElectronApi()
      if (!api) return Promise.reject(new Error('Electron API is not available'))
      return mutationFn(api, variables)
    },
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
        // SECURITY: Sanitise the error message before displaying it in a
        // toast notification.  Main-process errors (ENOENT, EACCES, etc.)
        // often embed absolute filesystem paths that leak the user's home
        // directory name and system structure to any UI component rendering
        // the toast, including split-screen panels where another context
        // could observe the error.
        const friendlyMessage =
          options?.errorMessage ||
          sanitizeErrorMessage((error as Error).message) ||
          'An error occurred'
        showError(friendlyMessage, 'Mutation Error', undefined, undefined)
      }
    }
  })
}
