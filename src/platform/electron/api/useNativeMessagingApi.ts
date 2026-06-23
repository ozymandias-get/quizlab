import { getElectronApi } from '@shared/lib/electronApi'

import { useMutation, useQueryClient } from '@tanstack/react-query'

const NATIVE_MESSAGING_KEY = ['native-messaging'] as const

function getApi() {
  const api = getElectronApi()
  if (!api?.nativeMessaging) throw new Error('Electron API not available')
  return api.nativeMessaging
}

export function useNativeMessagingInstallExtension() {
  return useMutation({
    mutationFn: async () => {
      const api = getApi()
      return api.installExtension()
    }
  })
}

export function useNativeMessagingRemoveExtension() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const api = getApi()
      return api.removeExtension()
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NATIVE_MESSAGING_KEY })
    }
  })
}
