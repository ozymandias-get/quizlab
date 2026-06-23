import { useAppVersion, useOpenExternal } from '@platform/electron/api/useSettingsSystemApi'

import { type UpdateInfo, useUpdate } from '@app/providers'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

import { useCallback, useMemo } from 'react'

interface UseSettingsReturn {
  appVersion: string | null
  updateStatus: 'checking' | 'error' | 'available' | 'latest' | 'idle'
  updateInfo: UpdateInfo | null
  checkForUpdates: () => Promise<void>
  openReleasesPage: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const {
    updateAvailable,
    updateInfo: appUpdateInfo,
    isCheckingUpdate,
    hasCheckedUpdate,
    checkForUpdates: appCheckForUpdates
  } = useUpdate()

  const { data: appVersion = '1.0.0' } = useAppVersion()
  const { mutate: openExternal } = useOpenExternal()

  const updateStatus = useMemo(() => {
    if (isCheckingUpdate) return 'checking'
    if (appUpdateInfo?.error) return 'error'
    if (updateAvailable) return 'available'
    if (hasCheckedUpdate && !updateAvailable) return 'latest'
    return 'idle'
  }, [isCheckingUpdate, appUpdateInfo, updateAvailable, hasCheckedUpdate])

  const checkForUpdates = useCallback(async () => {
    await appCheckForUpdates()
  }, [appCheckForUpdates])

  const openReleasesPage = useCallback(async () => {
    openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)
  }, [openExternal])

  return useMemo(
    () => ({
      appVersion,
      updateStatus,
      updateInfo: appUpdateInfo,
      checkForUpdates,
      openReleasesPage
    }),
    [appVersion, updateStatus, appUpdateInfo, checkForUpdates, openReleasesPage]
  )
}
