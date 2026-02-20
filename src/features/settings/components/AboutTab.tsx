import React, { useCallback } from 'react'
import { useLanguage, useAppearance, type UpdateInfo } from '@src/app/providers'
import { useClearCache } from '@platform/electron/api/useSystemApi'

import AppInfoSection from './about/AppInfoSection'
import UpdatesCard from './about/UpdatesCard'
import RepositoryLink from './about/RepositoryLink'
import CacheControl from './about/CacheControl'

interface AboutTabProps {
    appVersion: string;
    updateStatus: 'idle' | 'checking' | 'available' | 'latest' | 'error';
    updateInfo: UpdateInfo | null;
    checkForUpdates: () => Promise<void>;
    openReleasesPage: () => Promise<void>;
    onClose: () => void;
}

const AboutTab = React.memo(({
    appVersion,
    updateStatus,
    updateInfo,
    checkForUpdates,
    openReleasesPage,
    onClose
}: AboutTabProps) => {
    const { t } = useLanguage()
    const { startTour } = useAppearance()

    const { mutate: clearCache, isPending: isClearing, isSuccess: isClearSuccess } = useClearCache()

    const handleStartTour = useCallback(() => {
        if (onClose) onClose()
        setTimeout(() => {
            startTour()
        }, 300)
    }, [onClose, startTour])

    const handleClearCache = useCallback(() => {
        clearCache()
    }, [clearCache])

    return (
        <div className="space-y-8 pb-4">
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
                />
            </div>
        </div>
    )
})

AboutTab.displayName = 'AboutTab'

export default AboutTab



