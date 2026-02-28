import { useMemo } from 'react'
import { useUpdate, type UpdateInfo } from '@app/providers'
import { useAppVersion, useOpenExternal } from '@platform/electron/api/useSystemApi'

interface UseSettingsReturn {
    appVersion: string;
    updateStatus: 'checking' | 'error' | 'available' | 'latest' | 'idle';
    updateInfo: UpdateInfo | null;
    checkForUpdates: () => Promise<void>;
    openReleasesPage: () => Promise<void>;
}

/**
 * Settings modal için state ve işlemleri yöneten custom hook
 * Güncelleme state'leri UpdateContext'ten senkronize edilir
 */
export function useSettings(): UseSettingsReturn {
    // UpdateContext'ten güncelleme state'lerini al
    const {
        updateAvailable,
        updateInfo: appUpdateInfo,
        isCheckingUpdate,
        hasCheckedUpdate,
        checkForUpdates: appCheckForUpdates
    } = useUpdate()

    // Uygulama versiyonu - React Query ile al
    const { data: appVersion = '1.0.0' } = useAppVersion()
    const { mutate: openExternal } = useOpenExternal()

    // Update status - AppContext'ten türetilir
    const updateStatus = useMemo(() => {
        if (isCheckingUpdate) return 'checking'
        if (appUpdateInfo?.error) return 'error'
        if (updateAvailable) return 'available'
        if (hasCheckedUpdate && !updateAvailable) return 'latest'
        return 'idle'
    }, [isCheckingUpdate, appUpdateInfo, updateAvailable, hasCheckedUpdate])

    const updateInfo = appUpdateInfo

    // Güncelleme kontrolü - AppContext'teki fonksiyonu kullan
    const checkForUpdates = async () => {
        await appCheckForUpdates()
    }

    // GitHub Releases sayfasını aç
    const openReleasesPage = async () => {
        openExternal('https://github.com/ozymandias-get/quizlab/releases')
    }

    return {
        // App info
        appVersion,

        // Update
        updateStatus,
        updateInfo,
        checkForUpdates,
        openReleasesPage
    }
}




