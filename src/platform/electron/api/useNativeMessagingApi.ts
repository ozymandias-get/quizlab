import type {
  NativeMessagingExtensionInfo,
  NativeMessagingExtensionInstallResult,
  NativeMessagingProfileRemovalResult
} from '@shared-core/types'

import { getElectronApi, hasElectronApi } from '@shared/lib/electronApi'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

const NATIVE_MESSAGING_STATUS_KEY = ['native-messaging', 'status'] as const
const NATIVE_MESSAGING_PAIRING_CODE_KEY = ['native-messaging', 'pairing-code'] as const

/** How often the extension status is re-fetched while the query is mounted. */
const NATIVE_MESSAGING_POLL_MS = 5000

/**
 * The pairing code the user pastes into the extension popup.
 *
 * The query is disabled until the pairing dialog is open: the code is only
 * read when the user asks to pair.
 */
export function useNativeMessagingPairingCodeQuery(enabled: boolean) {
  return useQuery({
    queryKey: NATIVE_MESSAGING_PAIRING_CODE_KEY,
    queryFn: async (): Promise<string> => {
      const api = getElectronApi()
      if (!api?.nativeMessaging) throw new Error('Electron API not available')
      const result = await api.nativeMessaging.getPairingCode()
      return result.code
    },
    enabled,
    staleTime: Infinity,
    retry: false
  })
}

/**
 * Copies the extension that ships with the app to a folder the user can load.
 *
 * The main process writes the folder; the caller decides whether to copy the
 * path to the clipboard and how to explain the Chrome steps.
 */
export function useInstallExtensionMutation() {
  return useMutation({
    mutationFn: async (): Promise<NativeMessagingExtensionInstallResult> => {
      const api = getElectronApi()
      if (!api?.nativeMessaging?.installExtension) {
        throw new Error('Electron API not available')
      }
      return api.nativeMessaging.installExtension()
    }
  })
}

/**
 * Forgets one Chrome profile in the app.
 *
 * Removing the selected source clears the sessions imported from it in the
 * main process; the site-session list is refreshed by the broadcast the main
 * process sends after the action.
 */
export function useRemoveExtensionProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      profileId
    }: {
      profileId: string
    }): Promise<NativeMessagingProfileRemovalResult> => {
      const api = getElectronApi()
      if (!api?.nativeMessaging?.removeProfile) {
        throw new Error('Electron API not available')
      }
      return api.nativeMessaging.removeProfile(profileId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NATIVE_MESSAGING_STATUS_KEY })
    }
  })
}

/**
 * Live native-messaging extension status (STD-014). Centralizes the polling
 * interval and connect/disconnect event invalidation so consumers never wire
 * their own `setInterval` + `.then()` chains.
 */
export function useNativeMessagingStatusQuery() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasElectronApi()) return
    const api = getElectronApi()
    if (!api?.nativeMessaging) return

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: NATIVE_MESSAGING_STATUS_KEY })
    }
    const unsubConnected = api.nativeMessaging.onExtensionConnected(invalidate)
    const unsubDisconnected = api.nativeMessaging.onExtensionDisconnected(invalidate)
    return () => {
      unsubConnected()
      unsubDisconnected()
    }
  }, [queryClient])

  return useQuery({
    queryKey: NATIVE_MESSAGING_STATUS_KEY,
    queryFn: async (): Promise<NativeMessagingExtensionInfo | null> => {
      const api = getElectronApi()
      if (!api?.nativeMessaging) return null
      return api.nativeMessaging.getStatus()
    },
    refetchInterval: NATIVE_MESSAGING_POLL_MS,
    staleTime: NATIVE_MESSAGING_POLL_MS - 1000,
    retry: false
  })
}
