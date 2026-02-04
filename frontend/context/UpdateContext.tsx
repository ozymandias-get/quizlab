import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

export interface UpdateInfo {
    available: boolean;
    version?: string;
    releaseDate?: string;
    releaseName?: string;
    releaseNotes?: string;
    downloadUrl?: string;
    error?: string;
}

interface UpdateContextType {
    updateAvailable: boolean;
    updateInfo: UpdateInfo | null;
    isCheckingUpdate: boolean;
    hasCheckedUpdate: boolean;
    checkForUpdates: () => Promise<UpdateInfo>;
}

const UpdateContext = createContext<UpdateContextType | null>(null)
const UPDATE_CHECK_DELAY = 5000

export function UpdateProvider({ children }: { children: React.ReactNode }) {
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
    const [hasCheckedUpdate, setHasCheckedUpdate] = useState(false)

    const checkForUpdates = useCallback(async (): Promise<UpdateInfo> => {
        if (!window.electronAPI?.checkForUpdates) {
            setHasCheckedUpdate(true)
            return { available: false }
        }
        setIsCheckingUpdate(true)
        try {
            const result = await window.electronAPI.checkForUpdates()

            // Map Global Result to Context Info
            const info: UpdateInfo = {
                available: result.available,
                version: result.version,
                releaseName: result.releaseName, // Now available via global type
                releaseNotes: result.releaseNotes, // Mapped correctly
                error: result.error
            }

            if (result.error) {
                setUpdateAvailable(false)
                setUpdateInfo(info)
            } else if (result.available) {
                setUpdateAvailable(true)
                setUpdateInfo(info)
            } else {
                setUpdateAvailable(false)
                setUpdateInfo(null)
            }
            return info
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown_error'
            const errorInfo: UpdateInfo = { available: false, error: message }
            setUpdateInfo(errorInfo)
            return errorInfo
        } finally {
            setIsCheckingUpdate(false)
            setHasCheckedUpdate(true)
        }
    }, [])

    useEffect(() => {
        const timer = setTimeout(() => checkForUpdates(), UPDATE_CHECK_DELAY)
        return () => clearTimeout(timer)
    }, [checkForUpdates])

    const value = useMemo(() => ({
        updateAvailable, updateInfo, isCheckingUpdate, hasCheckedUpdate, checkForUpdates
    }), [updateAvailable, updateInfo, isCheckingUpdate, hasCheckedUpdate, checkForUpdates])

    return (
        <UpdateContext.Provider value={value}>
            {children}
        </UpdateContext.Provider>
    )
}

export const useUpdate = () => {
    const context = useContext(UpdateContext)
    if (!context) throw new Error('useUpdate must be used within UpdateProvider')
    return context
}
