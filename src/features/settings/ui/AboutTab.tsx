import {
  useCacheInfo,
  useClearCache,
  useDeepCleanCache
} from '@platform/electron/api/useSettingsSystemApi'

import { useTutorialStore } from '@features/tutorial/store/tutorialStore'

import type { UpdateInfo } from '@app/providers'
import { formatBytes } from '@shared/lib/formatUtils'
import { InfoIcon } from '@ui/components/Icons'

import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import AppInfoSection from './about/AppInfoSection'
import CacheControl from './about/CacheControl'
import IssueReportCard from './about/IssueReportCard'
import RepositoryLink from './about/RepositoryLink'
import UpdatesCard from './about/UpdatesCard'
import SettingsTabIntro from './shared/SettingsTabIntro'

interface AboutTabProps {
  appVersion: string | null
  updateStatus: 'idle' | 'checking' | 'available' | 'latest' | 'error'
  updateInfo: UpdateInfo | null
  checkForUpdates: () => Promise<void>
  openReleasesPage: () => Promise<void>
  onClose: () => void
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
        <SettingsTabIntro
          icon={
            <div className="border-primary/20 bg-primary/10 text-primary rounded-lg border p-2.5">
              <InfoIcon className="h-5 w-5" />
            </div>
          }
          description={t('configure_settings')}
        />

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
