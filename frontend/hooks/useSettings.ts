import { useState, useEffect, useMemo } from 'react'
import { useUpdate, UpdateInfo } from '../context/UpdateContext'

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

    // Uygulama versiyonu
    const [appVersion, setAppVersion] = useState<string>('1.0.0')

    // Update status - AppContext'ten türetilir
    const updateStatus = useMemo(() => {
        if (isCheckingUpdate) return 'checking'
        if (appUpdateInfo?.error) return 'error'
        if (updateAvailable) return 'available'
        if (hasCheckedUpdate && !updateAvailable) return 'latest'
        return 'idle'
    }, [isCheckingUpdate, appUpdateInfo, updateAvailable, hasCheckedUpdate])

    const updateInfo = appUpdateInfo

    // Uygulama sürümünü al
    useEffect(() => {
        if (window.electronAPI?.getAppVersion) {
            window.electronAPI.getAppVersion().then(version => {
                if (version) setAppVersion(version)
            })
        }
    }, [])

    // Güncelleme kontrolü - AppContext'teki fonksiyonu kullan
    const checkForUpdates = async () => {
        await appCheckForUpdates()
    }

    // GitHub Releases sayfasını aç
    const openReleasesPage = async () => {
        if (!window.electronAPI?.openReleasesPage) {
            if (window.electronAPI?.openExternal) {
                await window.electronAPI.openExternal('https://github.com/ozymandias-get/Quizlab-Reader/releases')
            } else {
                window.open('https://github.com/ozymandias-get/Quizlab-Reader/releases', '_blank', 'noopener,noreferrer')
            }
            return
        }
        await window.electronAPI.openReleasesPage()
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

