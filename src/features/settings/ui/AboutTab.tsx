import {
  useCacheInfo,
  useClearCache,
  useDeepCleanCache
} from '@platform/electron/api/useSettingsSystemApi'

import { useTutorialStore } from '@features/tutorial/store/tutorialStore'

import { type UpdateInfo } from '@app/providers'

import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import AppInfoSection from './about/AppInfoSection'
import CacheControl from './about/CacheControl'
import IssueReportCard from './about/IssueReportCard'
import RepositoryLink from './about/RepositoryLink'
import UpdatesCard from './about/UpdatesCard'

interface AboutTabProps {
  appVersion: string | null
  updateStatus: 'idle' | 'checking' | 'available' | 'latest' | 'error'
  updateInfo: UpdateInfo | null
  checkForUpdates: () => Promise<void>
  openReleasesPage: () => Promise<void>
  onClose: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const AboutTab = memo(
  ({
    appVersion,
    updateStatus,
    updateInfo,
    checkForUpdates,
    openReleasesPage,
    onClose
  }: AboutTabProps) => {
    const { t, i18n } = useTranslation()
    const language = i18n.language
    const startTutorial = useTutorialStore((s) => s.startTutorial)

    const {
      mutate: clearCache,
      isPending: isClearing,
      isSuccess: isClearSuccess,
      reset: resetClear
    } = useClearCache()
    const { mutate: deepCleanCache, isPending: isDeepCleaning } = useDeepCleanCache()
    const { data: cacheInfo } = useCacheInfo()

    const handleStartTour = useCallback(() => {
      if (onClose) onClose()
      window.setTimeout(() => startTutorial('general'), 300)
    }, [onClose, startTutorial])

    const handleClearCache = useCallback(() => {
      clearCache()
    }, [clearCache])

    const handleDeepClean = useCallback(() => {
      resetClear()
      deepCleanCache()
    }, [deepCleanCache, resetClear])

    const cacheSize = useMemo(() => {
      if (!cacheInfo?.breakdown?.total) return null
      return formatBytes(cacheInfo.breakdown.total)
    }, [cacheInfo])

    return (
      <div className="space-y-8 pb-4" data-app-locale={language}>
        <AppInfoSection t={t} appVersion={appVersion} />

        <div className="grid grid-cols-1 gap-4">
          <UpdatesCard
            updateStatus={updateStatus}
            updateInfo={updateInfo}
            t={t}
            handleStartTour={handleStartTour}
            checkForUpdates={checkForUpdates}
            openReleasesPage={openReleasesPage}
          />

          <RepositoryLink t={t} />

          <CacheControl
            t={t}
            handleClearCache={handleClearCache}
            isClearing={isClearing}
            isClearSuccess={isClearSuccess}
            handleDeepClean={handleDeepClean}
            isDeepCleaning={isDeepCleaning}
            cacheSize={cacheSize}
            lastCleanupTime={cacheInfo?.lastCleanup ?? null}
          />

          <IssueReportCard t={t} appVersion={appVersion} />
        </div>
      </div>
    )
  }
)

AboutTab.displayName = 'AboutTab'

export default AboutTab
