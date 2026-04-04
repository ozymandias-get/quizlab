import { useMemo } from 'react'
import { useUpdate, type UpdateInfo } from '@app/providers'
import { useAppVersion, useOpenExternal } from '@platform/electron/api/useSystemApi'
import { APP_CONSTANTS } from '@shared/constants/appConstants'

interface UseSettingsReturn {
  appVersion: string
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

  const updateInfo = appUpdateInfo

  const checkForUpdates = async () => {
    await appCheckForUpdates()
  }

  const openReleasesPage = async () => {
    openExternal(APP_CONSTANTS.GITHUB_RELEASES_URL)
  }

  return {
    appVersion,
    updateStatus,
    updateInfo,
    checkForUpdates,
    openReleasesPage
  }
}
