import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface ShellIntegrationStatus {
  supported: boolean
  installed: boolean
  label: string | null
  exePath: string | null
}

const SHELL_INTEGRATION_KEY = ['shell-integration', 'status'] as const

function getApi() {
  const api = getElectronApi()
  if (!api?.shellIntegration) throw new Error('Electron API not available')
  return api.shellIntegration
}

export function useShellIntegrationStatus() {
  return useQuery({
    queryKey: SHELL_INTEGRATION_KEY,
    queryFn: async (): Promise<ShellIntegrationStatus | null> => {
      if (!hasElectronApi()) return null
      const api = getElectronApi()
      if (!api?.shellIntegration) return null
      return api.shellIntegration.getStatus()
    },
    staleTime: 30 * 1000,
    retry: false
  })
}

export function useShellIntegrationInstall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (locale?: string) => {
      const api = getApi()
      return api.install(locale)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHELL_INTEGRATION_KEY })
    }
  })
}

export function useShellIntegrationRemove() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const api = getApi()
      return api.remove()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHELL_INTEGRATION_KEY })
    }
  })
}
