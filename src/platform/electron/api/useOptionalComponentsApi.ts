import type {
  OptionalComponentAction,
  OptionalComponentActionResult,
  OptionalComponentInfo
} from '@shared-core/types'

import type { UseQueryOptions } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'

import { useElectronMutation, useElectronQuery } from '../useElectron'

export const OPTIONAL_COMPONENTS_KEY = ['optional-components'] as const

/** Query the state of every whitelisted optional component. */
export function useOptionalComponents(
  options?: Omit<
    UseQueryOptions<OptionalComponentInfo[], Error, OptionalComponentInfo[]>,
    'queryKey' | 'queryFn'
  >
) {
  return useElectronQuery<OptionalComponentInfo[]>({
    key: OPTIONAL_COMPONENTS_KEY,
    queryFn: (api) => api.optionalComponents.list(),
    options: {
      staleTime: 0,
      retry: false,
      ...options
    }
  })
}

interface ComponentActionVariables {
  componentId: string
  action: OptionalComponentAction
}

/**
 * Run a lifecycle action (install/uninstall/repair/update/health_check) for a
 * whitelisted component. The component list is refreshed afterwards so UI
 * consumers observe the resulting status without manual invalidation.
 */
export function useOptionalComponentAction() {
  const queryClient = useQueryClient()

  return useElectronMutation<OptionalComponentActionResult, ComponentActionVariables>(
    (api, variables) => api.optionalComponents.runAction(variables.componentId, variables.action),
    {
      errorMessage: 'Failed to run optional component action',
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: OPTIONAL_COMPONENTS_KEY })
      }
    }
  )
}
